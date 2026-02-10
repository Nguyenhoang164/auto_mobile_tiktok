# config.py
import os

# --- CẤU HÌNH API VÀ FILE ---
SERVICE_ACCOUNT_FILE = 'service_account_key.json' 
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly', 
    'https://www.googleapis.com/auth/drive.readonly'
]

# --- ID TỪ GOOGLE DRIVE/SHEETS CỦA BẠN ---

# ID của file Google Sheet "Content đăng bài"
SHEET_ID = '1XIBUsQbWgHUmlUKIrShV1yjbwaa4ohHi4bofwLyG-K8' 

# ✅ DANH SÁCH CÁC TÊN SHEET (DANH MỤC) CẦN QUÉT
# Vui lòng cập nhật danh sách này nếu bạn có thêm Sheet/Danh mục
SHEET_NAMES_TO_PROCESS = ['Đồ lót', 'Tổng hợp', 'Công nghệ', 'Gia dụng', 'Mỹ phẩm']
# Chúng ta sẽ giả định tên thư mục Drive (ví dụ: '1. Đồ lót') sẽ khớp với tên Sheet (Đồ lót) 

# ID của thư mục gốc Drive "TIKTOK SGI đã up shopee"
ROOT_FOLDER_ID = '16Y9_6q3Ml0trazUmUfuneclMBQPjLWJ8' 

# Đường dẫn file Excel kết quả đầu ra
OUTPUT_FILE = 'ket_qua_doi_chieu_san_pham.xlsx'