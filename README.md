1. Cấu trúc và Vai trò thành phần chính

Dự án này là một hệ thống kết hợp giữa Python (xử lý dữ liệu đầu vào) và Node.js (điều khiển thiết bị thực thi).

    File auto_process.py (Bộ não khai thác dữ liệu):

        Nhiệm vụ: Đóng vai trò là "Data Miner". File này kết nối với Google Drive API để lấy dữ liệu (có thể là danh sách tài khoản TikTok, kịch bản nội dung, hoặc danh sách link video).

        Xử lý: Sau khi tải dữ liệu từ Drive về, nó sẽ thực hiện chuẩn hóa, lọc hoặc phân loại dữ liệu và lưu xuống một định dạng trung gian (thường là file JSON hoặc Excel trong thư mục dự án) để app.js có thể tiếp cận.

    File app.js (Bộ điều khiển thực thi):

        Nhiệm vụ: Đây là "Executor". Nó đọc các dữ liệu đã được xử lý xong từ bước trên.

        Xử lý: Sử dụng framework WebdriverIO/Appium để phân phối các tác vụ này xuống các thiết bị di động (máy thật hoặc giả lập) đang kết nối. Nó điều khiển các thao tác như đăng nhập, lướt, tương tác theo đúng dữ liệu đã nhận.

2. Luồng vận hành chi tiết (Workflow)

    Giai đoạn 1 (Python): Chạy auto_process.py. Script này sẽ xác thực với Google Drive, quét các tệp tin cần thiết, sau đó "đào" (extract) dữ liệu thô và chuyển đổi chúng thành tệp tin cục bộ sẵn sàng cho việc chạy máy.

    Giai đoạn 2 (Dữ liệu trung gian): Dữ liệu sau khi xử lý thường được lưu vào thư mục mà app.js có quyền truy cập (ví dụ file .xlsx trong thư mục xlsx/ mà tôi thấy trong pack).

    Giai đoạn 3 (Node.js): Chạy app.js. File này sẽ khởi tạo Appium Session, đọc dữ liệu từ file trung gian và bắt đầu ra lệnh cho các máy điện thoại thực hiện thao tác tự động trên TikTok.

3. Hướng dẫn cách chạy chi tiết cho người khác

Để vận hành hệ thống này, cần làm theo các bước sau:

Bước 1: Thiết lập môi trường Python (cho auto_process.py)

    Cài đặt Python 3.x.

    Cài đặt các thư viện cần thiết (ví dụ: google-api-python-client, google-auth-oauthlib, pandas...):
    Bash

    pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib pandas

    Đảm bảo có file credentials.json (Token từ Google Cloud Console) để Python có quyền truy cập Drive.

Bước 2: Thiết lập môi trường Node.js (cho app.js)

    Cài đặt Node.js và Appium.

    Chạy lệnh cài đặt thư viện: npm install.

Bước 3: Quy trình chạy hàng ngày

    Lấy dữ liệu: Chạy lệnh python auto_process.py. Đợi thông báo xử lý xong dữ liệu từ Drive.

    Kiểm tra thiết bị: Cắm các máy điện thoại vào, gõ adb devices để đảm bảo máy đã nhận.

    Chạy thực thi: Chạy lệnh node app.js để bắt đầu quá trình auto trên TikTok.

4. Một số lưu ý kỹ thuật

    Đồng bộ dữ liệu: Người chạy cần đảm bảo auto_process.py kết thúc hoàn toàn trước khi mở app.js để tránh xung đột dữ liệu hoặc đọc file rỗng.

    Cấu hình Drive: Nếu đổi tài khoản Drive hoặc cấu trúc thư mục trên Drive, cần cập nhật lại ID thư mục trong file auto_process.py.

    Đa thiết bị: app.js có thể được cấu hình để chạy song song nhiều máy nếu phần cứng máy tính đủ mạnh và Appium Server được thiết lập đúng.
