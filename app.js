const { remote } = require('webdriverio');
const XLSX = require('xlsx'); // CẦN CHẠY 'npm install xlsx'

// ===================================================================================
// --- CẤU HÌNH THIẾT BỊ VÀ JOB CỦA BẠN (QUAN TRỌNG) ---
// ===================================================================================
const EXCEL_FILE_PATH = 'ket_qua_doi_chieu_san_pham.xlsx'; 

const DEVICE_JOB_CONFIG = {
    // CẤU HÌNH THEO UDID CỦA ĐIỆN THOẠI
    '1492555577006610': { categories: ['Mỹ phẩm', 'Gia dụng', 'Công nghệ'], maxPosts: 5 },
    '149255557B006936': { categories: ['Tổng hợp'], maxPosts: 2 },
    '1517670586006201': { categories: ['Đồ lót'], maxPosts: 3 },
};

// CHỈ ĐỊNH UDID CỦA ĐIỆN THOẠI ĐANG CHẠY SCRIPT NÀY
const DEVICE_UDID = 'ce051605438c8e0a02'; 
// Nếu UDID không có trong config, nó sẽ nhận { categories: [], maxPosts: 0 }
const CURRENT_DEVICE_CONFIG = DEVICE_JOB_CONFIG[DEVICE_UDID] || { categories: [], maxPosts: 0 };

// ===================================================================================
// --- CẤU HÌNH TỰ ĐỘNG HÓA CƠ BẢN ---
// ===================================================================================
// CẤU HÌNH KẾT NỐI VỚI ỨNG DỤNG TIKTOK TRÊN ANDROID
const TIKTOK_PACKAGE = 'com.zhiliaoapp.musically.go'; 
const TIKTOK_ACTIVITY = 'com.ss.android.ugc.aweme.main.homepage.MainActivity'; 
const APP_SERVER_PORT = 4723;
const LIKE_BUTTON_ID = 'com.zhiliaoapp.musically.go:id/dna'; 
// CẤU HÌNH SWIPE VÀ CHỜ
const SWIPE_START_Y = 900; 
const SWIPE_END_Y = 100;   
const SWIPE_DURATION = 200; 
const SWIPE_X = 450; 
const WAIT_AFTER_PRESS = 100; 
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; 

// --- CẤU HÌNH DELAY ĐĂNG BÀI ---
const INITIAL_POST_DELAY_MINUTES = 30; 
const SUBSEQUENT_POST_DELAY_MINUTES = 15; 
const SCROLL_CHECK_INTERVAL_SECONDS = 15; 

// --- BIẾN ĐẾM VÀ TRẠNG THÁI ---
let driver;
let postsDoneToday = 0; 
let videosSwiped = 0; 
let postsCompletedInSession = 0; 
let lastPostTimestamp = 0; 

// ===================================================================================
// --- HÀM XỬ LÝ DỮ LIỆU EXCEL (GIỮ NGUYÊN) ---
// ===================================================================================

function getInitialSummary(filePath, deviceCategories) {
    const summary = {};
    if (deviceCategories.length === 0) return summary;
    try {
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);
        const requiredCategories = deviceCategories.map(c => c.toLowerCase());
        
        data.forEach(row => {
            const status = row['Status'] ? String(row['Status']).trim().toLowerCase() : '';
            const category = row['Danh mục'] ? String(row['Danh mục']).trim() : '';

            if (status === 'chưa đăng' && requiredCategories.includes(category.toLowerCase())) {
                summary[category] = (summary[category] || 0) + 1;
            }
        });

    } catch (e) {
        // Log lỗi rõ ràng nếu không đọc được file
        console.error(`❌ LỖI KHI ĐỌC FILE EXCEL để tổng hợp: Vui lòng kiểm tra file và đường dẫn.`, e.message);
    }
    return summary;
}
// ----------------------------------------------------------------------------------
function getPendingPosts(filePath, deviceConfig) {
    if (!deviceConfig || deviceConfig.categories.length === 0) return [];
    try {
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);
        const requiredCategories = deviceConfig.categories.map(c => c.toLowerCase());
        
        return data.filter(row => {
            const status = row['Status'] ? String(row['Status']).trim().toLowerCase() : '';
            const category = row['Danh mục'] ? String(row['Danh mục']).trim() : '';
            return status === 'chưa đăng' && requiredCategories.includes(category.toLowerCase());
        }).slice(0, deviceConfig.maxPosts - postsDoneToday); 

    } catch (e) {
        console.error(`❌ LỖI KHI ĐỌC FILE EXCEL để lấy bài đăng:`, e.message);
        return [];
    }
}

// ===================================================================================
// --- CHỨC NĂNG LƯỚT VÀ THẢ TIM ---
// ===================================================================================
// Chạy chế độ lướt và thả tim trong khoảng thời gian nhất định (hoặc vô hạn)
async function runScrollLikeMode(durationMs) {
    const startTime = Date.now();
    const isInfinite = (durationMs === Infinity);
    const totalDuration = isInfinite ? Infinity : durationMs;
// BÁO CÁO CHẾ ĐỘ ĐANG CHẠY
    if (isInfinite) {
        console.log(`\n=======================================================`);
        console.log(`👀 ĐANG CHẠY CHẾ ĐỘ LƯỚT VÀ LIKE (VÔ HẠN)...`);
        console.log(`=======================================================`);
    } else {
        const minutes = Math.ceil(durationMs / 60000);
        console.log(`\n=======================================================`);
        console.log(`⏳ ĐANG CHẠY CHẾ ĐỘ CHỜ (Delay) ${minutes} phút...`);
        console.log(`=======================================================`);
    }
// VÒNG LẶP CHÍNH CHO CHẾ ĐỘ LƯỚT VÀ THẢ TIM
    while (isInfinite || Date.now() - startTime < totalDuration) {
        let retries = 0;
        let success = false;
        
        if (!isInfinite) {
            let remaining = totalDuration - (Date.now() - startTime);
            if (remaining <= 0) break; 
        }

        while (retries < MAX_RETRIES && !success) {
            try {
                videosSwiped++;
                console.log(`\n--- Lướt Video #${videosSwiped} (Chế độ chờ/vô hạn) ---`);
                await driver.pause(10000); 
// Chờ video tải xong
                // LIKE LOGIC:
                if (videosSwiped % 3 === 0) {
                    try {
                        console.log(`⬆️ ĐANG THẢ TIM (Tìm ID) Video #${videosSwiped}.`);
                        const likeButton = await driver.$(`id=${LIKE_BUTTON_ID}`);
                        
                        const isDisplayed = await likeButton.waitForDisplayed({ timeout: 5000, interval: 500 });
                        
                        if (isDisplayed) { 
                            const location = await likeButton.getLocation();
                            const size = await likeButton.getSize();
                            
                            const centerX = Math.round(location.x + size.width / 2);
                            const centerY = Math.round(location.y + size.height / 2);
// Thực hiện thao tác chạm vào nút Like
                            await driver.performActions([
                                {
                                    type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
                                    actions: [
                                        { type: 'pointerMove', duration: 0, x: centerX, y: centerY, origin: 'viewport' },
                                        { type: 'pointerDown' },
                                        { type: 'pause', duration: 50 },
                                        { type: 'pointerUp' }
                                    ]
                                }
                            ]);
                            
                            console.log(`✅ ĐÃ THẢ TIM thành công (Chạm tọa độ: ${centerX}, ${centerY}).`);
                        } else {
                             console.log(`⚠️ LƯỚT: Nút Like không hiển thị trong 5 giây.`);
                        }
                    } catch (e) {
                        console.error(`⚠️ Lỗi khi thả tim: ${e.message.substring(0, 70)}...`);
                    }
                } else {
                    console.log(`➡️ LƯỚT: Bỏ qua thả tim.`);
                }

                // SWIPE:
                console.log(`⬆️ Đang lướt 1 NGÓN TAY...`);
                await driver.performActions([
                    {
                        type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
                        actions: [
                            { type: 'pointerMove', duration: 0, x: SWIPE_X, y: SWIPE_START_Y, origin: 'viewport' }, 
                            { type: 'pointerDown' }, 
                            { type: 'pause', duration: WAIT_AFTER_PRESS }, 
                            { type: 'pointerMove', duration: SWIPE_DURATION, x: SWIPE_X, y: SWIPE_END_Y, origin: 'viewport' }, 
                            { type: 'pointerUp' } 
                        ]
                    }
                ]);
                // Chờ sau khi lướt
                await driver.pause(5000); 
                success = true;

            } catch (error) {
                retries++;
                console.error(`\n*** ❌ LỖI NGHIÊM TRỌNG (Cần Retry): ${error.message.substring(0, 100)}... ***`);
                if (retries < MAX_RETRIES) {
                    console.log(`*** Tự động thử lại sau ${RETRY_DELAY_MS / 1000} giây... ***`);
                    await driver.pause(RETRY_DELAY_MS); 
                } else {
                    console.log(`🔴 THẤT BẠI: Lướt video #${videosSwiped} thất bại sau ${MAX_RETRIES} lần thử.`);
                    if (!isInfinite) throw new Error("Scroll mode failed repeatedly."); 
                }
            }
        } 
        
        if (!isInfinite && Date.now() - startTime >= totalDuration) {
            break;
        }
    }
}


// ===================================================================================
// --- LOGIC CHÍNH ---
// ===================================================================================

async function runAutomation() {
    
    // Khối cấu hình Capabilities và Server Options
    const caps = {
        "platformName": "Android", "appium:automationName": "UiAutomator2", "appium:deviceName": "My Real Phone", 
        "appium:udid": DEVICE_UDID, "appium:appPackage": TIKTOK_PACKAGE, "appium:appActivity": TIKTOK_ACTIVITY,
        "appium:noReset": true, "appium:forceAppLaunch": true, "appium:autoGrantPermissions": true,
        "appium:newCommandTimeout": 1800 
    };
    // Cấu hình kết nối Appium Server
    const options = { 
        hostname: '127.0.0.1', port: APP_SERVER_PORT, path: '/', capabilities: caps,
        connectionRetryTimeout: 120000 
    };
    // Bắt đầu kết nối và thực thi logic
    try {
        console.log("🛠️ Đang cố gắng kết nối với Appium Server...");
        driver = await remote(options);
        console.log(`✅ KẾT NỐI THÀNH CÔNG! Thiết bị: ${DEVICE_UDID}`);
        await driver.pause(5000); 

        // === BÁO CÁO TỔNG HỢP DỮ LIỆU ĐẦU VÀO ===
        // ===============================================================================
        const initialSummary = getInitialSummary(EXCEL_FILE_PATH, CURRENT_DEVICE_CONFIG.categories);
        console.log("\n======================================================================");
        console.log(`📊 TỔNG HỢP DỮ LIỆU ĐẦU VÀO CHO THIẾT BỊ (${DEVICE_UDID}):`);
        // In danh mục và chỉ tiêu
        const categoriesHandled = CURRENT_DEVICE_CONFIG.categories.join(', ');
        if (categoriesHandled) {
             console.log(`   - Thiết bị này phụ trách các danh mục: ${categoriesHandled}`);
             console.log(`   - Chỉ tiêu tối đa hôm nay: ${CURRENT_DEVICE_CONFIG.maxPosts} bài`);
        } else {
             console.log(`   - Thiết bị này KHÔNG được cấu hình danh mục. Sẽ chỉ lướt video.`);
        }
       // In tóm tắt bài tồn đọng
        if (Object.keys(initialSummary).length > 0) {
            console.log("\n   📦 BÀI VIẾT TỒN ĐỌNG (STATUS: CHƯA ĐĂNG):");
            for (const category in initialSummary) {
                console.log(`     - [${category}]: ${initialSummary[category]} bài`);
            }
        } else {
            console.log("\n   ✅ TẤT CẢ CÁC BÀI TỒN ĐỌNG (CHƯA ĐĂNG) ĐỀU ĐƯỢC LỌC RA.");
        }
        console.log("======================================================================");
        // ===============================================================================

        // === KIỂM TRA ĐIỀU KIỆN 1: Nếu không có danh mục được gán, chỉ lướt vô hạn ===
        if (CURRENT_DEVICE_CONFIG.categories.length === 0) {
            console.log("\n➡️ CHUYỂN SANG CHẾ ĐỘ LƯỚT VÔ HẠN VÌ KHÔNG CÓ DANH MỤC ĐĂNG BÀI ĐƯỢC GÁN.");
            await runScrollLikeMode(Infinity);
            return; // Thoát hàm sau khi hoàn thành nhiệm vụ lướt
        }
        // ===========================================================================

        // === VÒNG LẶP CHÍNH ĐỂ XỬ LÝ BÀI ĐĂNG THEO KẾ HOẠCH VÀ DELAY ===
        // --- VÒNG LẶP CHẠY LIÊN TỤC (DAEMON) ---
        while (true) {
            // Kiểm tra nếu đã hoàn thành chỉ tiêu hôm nay
            const pendingPostsList = getPendingPosts(EXCEL_FILE_PATH, CURRENT_DEVICE_CONFIG);
            const postsToMake = pendingPostsList.length;

            if (postsToMake > 0) {
                
                // 1. Xác định thời gian chờ cần thiết
                let requiredDelayMinutes = 0;
                if (postsCompletedInSession === 0) {
                    requiredDelayMinutes = 0; // Bài đầu tiên, không delay trước khi đăng
                } else if (postsCompletedInSession === 1) {
                    requiredDelayMinutes = INITIAL_POST_DELAY_MINUTES; // 30 phút sau bài 1
                } else if (postsCompletedInSession >= 2) {
                    requiredDelayMinutes = SUBSEQUENT_POST_DELAY_MINUTES; // 15 phút sau bài 2 trở đi
                }
                
                // 2. Kiểm tra nếu cần chờ
                const currentTime = Date.now();
                const delayInMs = requiredDelayMinutes * 60 * 1000;
                const elapsedTimeSinceLastPost = currentTime - lastPostTimestamp;
                
                if (lastPostTimestamp > 0 && elapsedTimeSinceLastPost < delayInMs) {
                    // DELAY IS ACTIVE. Chạy chế độ lướt/like cho thời gian còn lại.
                    const remainingWaitTimeMs = delayInMs - elapsedTimeSinceLastPost;
                    
                    await runScrollLikeMode(remainingWaitTimeMs); 
                    
                    continue; // Quay lại đầu vòng lặp để kiểm tra lại (sẽ thấy delay đã hết)
                }

                // 3. Đã đủ thời gian chờ (hoặc là bài đầu tiên). Xử lý bài đăng.
                console.log("\n======================================================================");
                console.log(`🔥 ĐÃ ĐỦ THỜI GIAN CHỜ. HIỂN THỊ CHI TIẾT BÀI ĐĂNG #${postsCompletedInSession + 1} (${pendingPostsList[0]['Danh mục']}).`);
                console.log("======================================================================");
                
                // IN DỮ LIỆU BÀI ĐẦU TIÊN CẦN XỬ LÝ
                console.log(`\n--- Bài đăng SẴN SÀNG #${postsCompletedInSession + 1} ---`);
                console.log(JSON.stringify(pendingPostsList[0], null, 2));
                console.log("-------------------------------------");
                console.log(`\n⏸️ HỆ THỐNG ĐANG DỪNG (90s) ĐỂ BẠN THỰC HIỆN ĐĂNG BÀI VÀ CẬP NHẬT EXCEL.`);
                console.log(`   * SAU KHI ĐĂNG XONG, BẠN PHẢI CHUYỂN STATUS BÀI ĐÓ SANG 'Đã Đăng' TRONG EXCEL.`);
                const nextDelayMinutes = postsCompletedInSession === 0 ? INITIAL_POST_DELAY_MINUTES : SUBSEQUENT_POST_DELAY_MINUTES;
                console.log(`   * CHƯƠNG TRÌNH SẼ TỰ ĐỘNG CHUYỂN SANG CHẾ ĐỘ CHỜ ${nextDelayMinutes} PHÚT SAU ĐÓ.`);
                
                // 4. Chờ người dùng đăng bài
                await driver.pause(90000); 
                
                // 5. Cập nhật trạng thái cho lần chạy tiếp theo
                postsCompletedInSession++;
                lastPostTimestamp = Date.now();
                
            } else {
                // Không có bài đăng nào cần làm, chạy chế độ lướt/like vô hạn
                await runScrollLikeMode(Infinity); 
            }
        } 
    } catch (error) {
        console.error(`\n❌ LỖI KẾT NỐI CHƯƠNG TRÌNH: ${error.message}`);
    } finally {
        if (driver) {
            await driver.deleteSession();
            console.log("\n👋 Đã kết thúc phiên làm việc.");
        }
    }
}

runAutomation();