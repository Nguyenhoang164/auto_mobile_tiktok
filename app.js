const { remote } = require('webdriverio');

// --- CẤU HÌNH CÁC THÔNG SỐ CHÍNH XÁC CỦA BẠN ---
const DEVICE_UDID = 'ce051605438c8e0a02'; 
const TIKTOK_PACKAGE = 'com.zhiliaoapp.musically.go'; 
const TIKTOK_ACTIVITY = 'com.ss.android.ugc.aweme.main.homepage.MainActivity';

let driver;

async function openTikTokLite() {
    
    // 1. Cấu hình Capabilities
    const caps = {
        "platformName": "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": "My Real Phone", 
        "appium:udid": DEVICE_UDID,
        "appium:appPackage": TIKTOK_PACKAGE, 
        "appium:appActivity": TIKTOK_ACTIVITY,
        "appium:noReset": true, // Giữ nguyên trạng thái ứng dụng
    };

    const options = {
        hostname: '127.0.0.1',
        port: 4723,
        path: '/',
        capabilities: caps
    };

    try {
        console.log("🛠️ Đang cố gắng kết nối với Appium Server...");
        driver = await remote(options);
        
        console.log(`✅ KẾT NỐI THÀNH CÔNG! TikTok Lite sẽ được mở. (Appium/WebdriverIO)`);
        
        // Tạm dừng 10 giây để bạn quan sát ứng dụng
        await driver.pause(10000); 
        
    } catch (error) {
        console.error(`\n❌ LỖI KHỞI TẠO HOẶC KẾT NỐI: ${error.message}`);
        console.log("--------------------------------------------------------------------------");
        console.log("GỢI Ý: Lỗi phổ biến nhất là Appium Server chưa chạy hoặc ADB không nhận diện thiết bị (unauthorized).");
    } finally {
        if (driver) {
            await driver.deleteSession();
            console.log("\n👋 Đã kết thúc phiên làm việc.");
        }
    }
}

openTikTokLite();