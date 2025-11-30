const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

// Ed25519 공개키 (SSH 형식을 Node.js crypto에서 사용 가능한 형식으로)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAWFHz+DlwVshI6PKdIPFQ6cFN8Ow/FVnOFbesoXDVFXU=
-----END PUBLIC KEY-----`;

class License {
    constructor(userDataPath) {
        this.licenseFilePath = path.join(userDataPath, "license.json");
    }

    // 로컬 라이선스 파일 확인
    checkLocalLicense() {
        try {
            if (!fs.existsSync(this.licenseFilePath)) {
                return { valid: false, reason: "no_local_license" };
            }

            const licenseData = JSON.parse(fs.readFileSync(this.licenseFilePath, "utf8"));

            if (!licenseData.licence || !licenseData.signature) {
                return { valid: false, reason: "invalid_license_format" };
            }

            // 서명 검증
            const isValid = this.verifySignature(licenseData.licence, licenseData.signature);

            if (!isValid) {
                return { valid: false, reason: "invalid_signature" };
            }

            // 프로그램 확인
            if (licenseData.licence.product !== "localkeys") {
                return { valid: false, reason: "invalid_product" };
            }

            return {
                valid: true,
                licence: licenseData.licence,
            };
        } catch (error) {
            return { valid: false, reason: "error", error: error.message };
        }
    }

    // Ed25519 서명 검증
    verifySignature(licence, signatureBase64) {
        try {
            // licence 객체를 JSON 문자열로 변환 (서버와 동일한 방식)
            const message = JSON.stringify(licence);

            // Base64 서명을 Buffer로 변환
            const signature = Buffer.from(signatureBase64, "base64");

            // Ed25519 서명 검증 (해시 알고리즘 지정 안 함)
            return crypto.verify(
                null, // Ed25519는 해시 알고리즘 필요 없음
                Buffer.from(message),
                {
                    key: PUBLIC_KEY,
                    format: "pem",
                    type: "spki",
                },
                signature
            );
        } catch (error) {
            return false;
        }
    }

    // 서버에 라이선스 확인 요청
    async checkLicenseWithServer(userKey, password) {
        return new Promise((resolve) => {
            const postData = JSON.stringify({
                userKey,
                password,
                program: "localkeys",
            });

            const options = {
                hostname: "id.privatestater.com",
                port: 443,
                path: "/api/id/license/checkkeypw",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                },
                timeout: 10000,
            };

            const req = https.request(options, (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    try {
                        const response = JSON.parse(data);

                        if (res.statusCode === 200 && response.licence && response.signature) {
                            // 서명 검증
                            const isValid = this.verifySignature(response.licence, response.signature);

                            if (!isValid) {
                                resolve({ success: false, error: "invalid_signature" });
                                return;
                            }

                            // 프로그램 확인
                            if (response.licence.product !== "localkeys") {
                                resolve({ success: false, error: "invalid_product" });
                                return;
                            }

                            resolve({
                                success: true,
                                licence: response.licence,
                                signature: response.signature,
                            });
                        } else if (response.error) {
                            resolve({ success: false, error: response.error });
                        } else {
                            resolve({ success: false, error: "unknown_error" });
                        }
                    } catch (error) {
                        resolve({ success: false, error: "parse_error", details: error.message });
                    }
                });
            });

            req.on("error", (error) => {
                resolve({ success: false, error: "network_error", details: error.message });
            });

            req.on("timeout", () => {
                req.destroy();
                resolve({ success: false, error: "timeout" });
            });

            req.write(postData);
            req.end();
        });
    }

    // 라이선스 파일 저장
    saveLicense(licence, signature) {
        try {
            const licenseData = {
                licence,
                signature,
                savedAt: new Date().toISOString(),
            };

            fs.writeFileSync(this.licenseFilePath, JSON.stringify(licenseData, null, 2), "utf8");
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 라이선스 파일 삭제 (테스트용)
    deleteLicense() {
        try {
            if (fs.existsSync(this.licenseFilePath)) {
                fs.unlinkSync(this.licenseFilePath);
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = License;
