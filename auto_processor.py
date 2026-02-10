import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from config import SERVICE_ACCOUNT_FILE, SCOPES, SHEET_ID, ROOT_FOLDER_ID, OUTPUT_FILE, SHEET_NAMES_TO_PROCESS
import sys
import os
from collections import defaultdict

# --- CÁC HÀM TRỢ GIÚP ---

def get_google_services():
    """Xác thực bằng Service Account."""
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"\n❌ LỖI: Không tìm thấy file xác thực '{SERVICE_ACCOUNT_FILE}'.")
        sys.exit(1)
    try:
        creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        service_sheets = build('sheets', 'v4', credentials=creds)
        service_drive = build('drive', 'v3', credentials=creds)
        return service_sheets, service_drive
    except Exception as e:
        print(f"\n❌ LỖI XÁC THỰC: {e}")
        sys.exit(1)

def find_folder_by_name(drive_service, parent_folder_id, folder_name):
    """Tìm ID thư mục. Hỗ trợ khớp tên linh hoạt (ví dụ 'Gia dụng' khớp '5. Gia dụng')."""
    query = f"'{parent_folder_id}' in parents and name contains '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    response = drive_service.files().list(q=query, fields='files(id, name)').execute()
    files = response.get('files', [])
    
    if not files:
        return None, None

    # Ưu tiên folder chứa từ khóa chính xác nhất
    for file in files:
        if folder_name.lower() in file['name'].lower():
            return file['id'], file['name']
    
    return files[0]['id'], files[0]['name']

def get_all_videos_grouped(drive_service, parent_folder_id, folder_id_to_scan, display_name, product_codes_set, is_root_scan=False):
    """Quét video dựa trên vị trí: trong folder con hoặc trực tiếp trong folder cha."""
    if is_root_scan:
        query = (
            f"'{parent_folder_id}' in parents and "
            f"(mimeType contains 'video' or name contains '.mp4' or name contains '.mov') and "
            f"mimeType != 'application/vnd.google-apps.folder' and trashed = false"
        )
    else:
        query = (
            f"'{folder_id_to_scan}' in parents and "
            f"(mimeType contains 'video' or name contains '.mp4' or name contains '.mov') and trashed = false"
        )
    
    videos_found = defaultdict(list)
    page_token = None
    
    try:
        while True:
            response = drive_service.files().list(
                q=query, 
                fields='nextPageToken, files(name, webViewLink)',
                pageSize=1000,
                pageToken=page_token
            ).execute()
            
            files = response.get('files', [])
            for f in files:
                file_name = f['name']
                file_link = f.get('webViewLink', 'N/A')
                base_name_normalized = os.path.splitext(file_name)[0].strip().lower().replace(' ', '_').replace('-', '_')
                
                found_code = None
                for code in product_codes_set:
                    if code and code in base_name_normalized:
                        found_code = code
                        break
                
                if found_code:
                    videos_found[found_code].append({
                        'full_file_name': file_name,
                        'link': file_link,
                        'folder': display_name 
                    })
            
            page_token = response.get('nextPageToken', None)
            if page_token is None: break
                
    except Exception as e:
        print(f"   ❌ LỖI QUÉT {display_name}: {e}")
        return {}

    return videos_found

# --- HÀM XỬ LÝ CHÍNH ---
def process_data_automatically():
    print("--- 1. Khởi tạo API ---")
    sheets_service, drive_service = get_google_services()
    all_final_video_rows = [] 

    print("--- 2. Bắt đầu Quét dữ liệu ---")
    
    for sheet_name in SHEET_NAMES_TO_PROCESS:
        range_to_read = f"'{sheet_name}'!A:L" 
        print(f"\n[DANH MỤC] Đang xử lý: {sheet_name}")
        
        try:
            result = sheets_service.spreadsheets().values().get(spreadsheetId=SHEET_ID, range=range_to_read).execute()
            values = result.get('values', [])
        except Exception as e:
            print(f"❌ Lỗi đọc Sheet: {e}"); continue 
        
        if not values or len(values) < 2: continue
        
        headers = values[0]
        df_original = pd.DataFrame(values[1:], columns=headers)
        df_original['Danh mục'] = sheet_name 
        
        # Chuẩn hóa mã sản phẩm để so khớp
        df_original['Mã SP Normalized'] = df_original['Mã sản phẩm'].astype(str).str.strip().str.lower().str.replace(' ', '_').str.replace('-', '_')
        df_unique = df_original.drop_duplicates(subset=['Mã SP Normalized'], keep='first').copy()
        product_codes_set = set(df_unique['Mã SP Normalized'].unique())

        # Tìm thư mục Danh mục trên Drive (ví dụ: "5. Gia dụng")
        cat_id, cat_real_name = find_folder_by_name(drive_service, ROOT_FOLDER_ID, sheet_name)
        if not cat_id:
             print(f"   → ❌ Không tìm thấy thư mục '{sheet_name}' trên Drive."); continue
             
        # QUY TRÌNH QUÉT:
        all_found = defaultdict(list)
        
        # 1. Quét folder 'done' -> Đã Đăng
        done_id, _ = find_folder_by_name(drive_service, cat_id, 'done')
        if done_id:
            vids = get_all_videos_grouped(drive_service, None, done_id, 'done', product_codes_set, False)
            for code, items in vids.items():
                for itm in items: itm['Trạng Thái'] = 'Đã Đăng'
                all_found[code].extend(items)

        # 2. Quét folder Gốc (cùng cấp với done) -> Chưa Đăng
        root_vids = get_all_videos_grouped(drive_service, cat_id, None, cat_real_name, product_codes_set, True)
        for code, items in root_vids.items():
            for itm in items: itm['Trạng Thái'] = 'Chưa Đăng'
            # Tránh trùng nếu file cùng tên ở cả 2 nơi (ưu tiên folder done đã quét trước)
            existing_names = {v['full_file_name'] for v in all_found[code]}
            for itm in items:
                if itm['full_file_name'] not in existing_names:
                    all_found[code].append(itm)

        # Hợp nhất vào bảng kết quả
        for _, row in df_unique.iterrows():
            code_norm = row['Mã SP Normalized']
            vids = all_found.get(code_norm, [])
            
            if vids:
                for v in vids:
                    new_row = row.to_dict()
                    new_row['Trạng Thái'] = v['Trạng Thái']
                    new_row['Vị Trí File'] = v['folder']
                    new_row['Tên File Video'] = v['full_file_name']
                    new_row['Link Drive Video'] = v['link']
                    all_final_video_rows.append(new_row)
            else:
                new_row = row.to_dict()
                new_row['Trạng Thái'] = 'Chưa Sản Xuất'
                new_row['Vị Trí File'] = 'N/A'
                new_row['Tên File Video'] = '[CẦN LÀM]'
                new_row['Link Drive Video'] = 'N/A'
                all_final_video_rows.append(new_row)

    # Xuất file Excel
    if all_final_video_rows:
        final_df = pd.DataFrame(all_final_video_rows)
        # Bỏ cột trung gian và cột yêu cầu bỏ
        final_df = final_df.drop(columns=['Mã SP Normalized', 'Video Sequence', 'Tình Trạng Tổng Hợp SP'], errors='ignore')
        
        # Sắp xếp thứ tự cột
        cols = ['Mã sản phẩm', 'Trạng Thái', 'Vị Trí File', 'Tên File Video', 'Link Drive Video', 'Danh mục']
        cols += [c for c in final_df.columns if c not in cols]
        final_df[cols].to_excel(OUTPUT_FILE, index=False)
        print(f"\n✅ Đã tạo file báo cáo: {OUTPUT_FILE}")
    else:
        print("\n❌ Không tìm thấy dữ liệu để xuất file.")

if __name__ == '__main__':
    process_data_automatically()