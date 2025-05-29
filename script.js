const urlInput = document.getElementById('urlInput');
const downloadButton = document.getElementById('downloadButton');
const resultsArea = document.getElementById('resultsArea');

function downloadNames_Sangtacviet(url) {
    resultsArea.innerHTML = "<p>Đang xử lý URL...</p>";
    if (url.slice(-1) === "/") url = url.slice(0, -1);

    let host = url.split('/truyen/')[0];
    let params = url.split('/truyen/')[1].split('/');
    
    let bookhost, bookid;

    if (params.length >= 2) {
        bookhost = params[0];
        bookid = params[1];
    } else {
        alert("Link không đúng định dạng mong muốn để trích xuất bookhost và bookid!\nCần có dạng: .../truyen/BOOKHOST/BOOKID/...");
        resultsArea.innerHTML = "<p>Lỗi: Link không đúng định dạng.</p>";
        return;
    }

    if (!bookhost || !bookid) {
        alert("Link sai sai! Không thể xác định bookhost hoặc bookid.");
        resultsArea.innerHTML = "<p>Lỗi: Không thể xác định bookhost hoặc bookid.</p>";
        return;
    }

    let actualNamesysUrl = `${host}/namesys.php?host=${bookhost}&book=${bookid}`;
    let proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(actualNamesysUrl)}`;

    resultsArea.innerHTML = `<p>Đang tải dữ liệu từ: ${actualNamesysUrl} (qua proxy)...</p>`;
    console.log("Đang gọi API qua proxy:", proxyUrl);
    console.log("Host gốc:", host);
    console.log("Book Host:", bookhost);
    console.log("Book ID:", bookid);

    fetch(proxyUrl)
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Lỗi HTTP: ${response.status} (${response.statusText}) khi gọi proxy. Phản hồi từ proxy: ${text.substring(0, 200)}...`);
                });
            }
            return response.text();
        })
        .then(text => {
            console.log("Phản hồi thô dạng TEXT từ proxy:", text);
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("Lỗi khi parse JSON:", e);
                resultsArea.innerHTML = `<p>Lỗi: Không thể phân tích phản hồi từ proxy. Proxy có thể đang gặp sự cố hoặc trả về dữ liệu không hợp lệ. Chi tiết: ${e.message}. Xem Console (F12) để thấy phản hồi thô.</p>`;
                throw new Error(`Không thể parse phản hồi từ proxy thành JSON. Phản hồi thô bắt đầu bằng: ${text.substring(0, 200)}...`);
            }

            console.log("Dữ liệu JSON nhận được từ proxy (đã parse):", data);
            if (!data || typeof data.contents === 'undefined') {
                resultsArea.innerHTML = "<p>Lỗi: Proxy không trả về 'contents'. Proxy có thể đã thay đổi API hoặc không lấy được nội dung.</p>";
                throw new Error("Không tìm thấy 'contents' trong dữ liệu trả về từ proxy. Phản hồi có thể không như mong đợi.");
            }
            
            const htmlString = data.contents;
            if (typeof htmlString !== 'string') {
                 resultsArea.innerHTML = "<p>Lỗi: 'contents' từ proxy không phải là một chuỗi HTML.</p>";
                throw new Error("'contents' không phải là chuỗi. Nội dung nhận được: " + JSON.stringify(htmlString));
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, "text/html");

            if (!doc || !doc.body) {
                resultsArea.innerHTML = "<p>Lỗi: Không thể phân tích chuỗi HTML từ 'contents'.</p>";
                throw new Error("Không thể phân tích chuỗi HTML từ 'contents'. Chuỗi HTML: " + htmlString.substring(0,200) + "...");
            }
            if (doc.body.innerHTML.trim() === "") {
                console.warn("HTML body từ 'contents' trống hoặc chỉ chứa whitespace. Có thể trang đích không có nội dung hoặc proxy không lấy được.");
            }

            const extractedPackages = [];
            const nameDivSelector = 'div[style="white-space:nowrap;overflow:hidden;max-width:140px;max-height:26px;font-size:12px;"]';
            const nameDivs = doc.querySelectorAll(nameDivSelector);

            if (nameDivs.length === 0) {
                resultsArea.innerHTML = "<p>Không tìm thấy gói name nào trong dữ liệu HTML từ trang đích. Có thể selector CSS không đúng, trang không có name theo cấu trúc này, hoặc trang đích bị chặn (ví dụ bởi Cloudflare).</p>" +
                                        "<p>HTML nhận được (phần đầu): <code>" + escapeHtml(htmlString.substring(0, 500)) + "...</code></p>";
                return;
            }
            
            resultsArea.innerHTML = `<p>Đã tìm thấy ${nameDivs.length} khối dữ liệu có thể là name. Đang trích xuất...</p>`;

            nameDivs.forEach((nameDiv, index) => {
                const namesText = nameDiv.innerText.trim();
                
                let packageName = `Gói_${index + 1}`;
                let wordCount = "N/A";
                let timestamp = "N/A";

                let prevNode = nameDiv.previousSibling;
                while(prevNode && (prevNode.nodeType !== Node.TEXT_NODE || !prevNode.textContent.trim())) {
                    prevNode = prevNode.previousSibling;
                }
                if (prevNode && prevNode.textContent.trim()) {
                    packageName = prevNode.textContent.trim();
                }

                let nextNode = nameDiv.nextSibling;
                while(nextNode && (nextNode.nodeType !== Node.TEXT_NODE || !nextNode.textContent.trim())) {
                    nextNode = nextNode.nextSibling;
                }
                if (nextNode && nextNode.textContent.trim()) {
                    wordCount = nextNode.textContent.trim();
                    
                    let tsNode = nextNode.nextSibling;
                    while(tsNode && (tsNode.nodeType !== Node.TEXT_NODE || !tsNode.textContent.trim())) {
                        tsNode = tsNode.nextSibling;
                    }
                    if (tsNode && tsNode.textContent.trim()) {
                        timestamp = tsNode.textContent.trim();
                    }
                }
                
                if (namesText) {
                     extractedPackages.push({
                        packageName,
                        namesText,
                        wordCount,
                        timestamp
                    });
                }
            });
            
            if (extractedPackages.length === 0) {
                resultsArea.innerHTML = "<p>Không trích xuất được gói name nào có nội dung! (Mặc dù đã tìm thấy các khối div khớp selector).</p>";
                return;
            }

            resultsArea.innerHTML = "<h3>Các gói name tìm thấy:</h3>";
            var zip = new JSZip(); // JSZip is global from CDN

            extractedPackages.forEach(pkg => {
                resultsArea.innerHTML += `<div class="package-info"><strong>${pkg.packageName}</strong> (${pkg.wordCount} từ, ${pkg.timestamp})</div>`;
                
                let text_input = pkg.namesText;
                if (text_input.startsWith("$")) {
                    text_input = text_input.substring(1);
                }
                let processedNames = text_input.split('\n$').join('\n');
                
                let safePackageName = pkg.packageName.replace(/[^a-z0-9_\-\s\u00C0-\u024F\u1E00-\u1EFF]/gi, '').trim().replace(/\s+/g, '_');
                let safeTimestamp = pkg.timestamp.replace(/[:\s]/g, '-');
                let fileName = `${safePackageName}_${pkg.wordCount}từ_${safeTimestamp}.txt`;
                
                zip.file(fileName, processedNames);
            });

            if (Object.keys(zip.files).length === 0) {
                resultsArea.innerHTML += "<p>Không có name hợp lệ để tạo ZIP.</p>";
                return;
            }

            let fileTimestamp = Math.floor(Date.now() / 1000);
            zip.generateAsync({ type: "blob" })
                .then(content => {
                    saveAs(content, `Names_${bookhost}-${bookid}_${fileTimestamp}.zip`); // saveAs is global from CDN
                    resultsArea.innerHTML += "<p><strong>Đã tạo và tải xuống file ZIP!</strong></p>";
                })
                .catch(err => {
                    console.error("Lỗi khi tạo file zip:", err);
                    resultsArea.innerHTML += "<p>Lỗi khi tạo ZIP: " + err.message + "</p>";
                });
        })
        .catch(error => {
            console.error("Fetch hoặc xử lý thất bại:", error);
            resultsArea.innerHTML = `<p><strong>LỖI CUỐI CÙNG:</strong> ${error.message}</p><p>Vui lòng kiểm tra Console (F12) để xem "Phản hồi thô dạng TEXT từ proxy" và các thông báo lỗi chi tiết khác.</p>`;
        });
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Event listener
if (downloadButton) { // Ensure the button exists before adding listener
    downloadButton.addEventListener('click', function() {
        const url = urlInput.value.trim();
        if (!url) {
            alert("Vui lòng nhập URL của truyện!");
            resultsArea.innerHTML = "<p>Lỗi: Vui lòng nhập URL.</p>";
            return;
        }
        if (!url.includes('/truyen/')) {
            alert("URL không hợp lệ. URL phải chứa '/truyen/'.\nVí dụ: https://sangtacviet.app/truyen/uukanshu/82614/ten-truyen/");
            resultsArea.innerHTML = "<p>Lỗi: URL không hợp lệ.</p>";
            return;
        }
        downloadNames_Sangtacviet(url);
    });
} else {
    console.error("Không tìm thấy nút downloadButton!");
}
