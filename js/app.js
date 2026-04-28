// js/app.js

const App = {
    init: function() {
        this.bindEvents();
        this.checkLogin();
        
        // 하위 모듈 초기화
        CatchManager.init();
    },

    checkLogin: function() {
        const playerInfo = Storage.getPlayerInfo();
        const hasSeenIntro = Storage.hasSeenIntro();

        if (!playerInfo.name) {
            document.getElementById('loginScreen').classList.remove('hidden');
        } else {
            document.getElementById('loginScreen').classList.add('hidden');
            if (!hasSeenIntro) {
                this.startIntro();
            } else {
                this.startGame();
            }
        }

        document.getElementById('btnStart').addEventListener('click', () => {
            const inputId = document.getElementById('inputPlayerId').value.trim();
            const inputName = document.getElementById('inputPlayerName').value.trim();
            
            if (inputId.length > 0 && inputName.length > 0) {
                Storage.setPlayerInfo(inputId, inputName);
                document.getElementById('loginScreen').classList.add('hidden');
                this.startIntro();
            } else {
                alert("학번과 이름을 모두 입력해주세요.");
            }
        });
    },

    startIntro: function() {
        const introScreen = document.getElementById('introScreen');
        const dialogueText = document.getElementById('dialogueText');
        const dialogueName = document.getElementById('dialogueName');
        const introBg = document.getElementById('introBg');
        const introCharacter = document.getElementById('introCharacter');
        
        introScreen.classList.remove('hidden');
        
        const playerInfo = Storage.getPlayerInfo();
        const playerName = playerInfo.name;
        const scripts = [
            { name: playerName, text: "드디어 오늘이 대성 야간 걷기 행사 날인가! 정말 기대된다." },
            { name: playerName, text: "친구들이랑 같이 걷다 보면 금방 목적지에 도착하겠지? ㅎㅎ" },
            { name: "시스템", text: "(갑자기 학교 건물이 크게 흔들리기 시작한다!)", action: "shake" },
            { name: playerName, text: "어?! 뭐... 뭐야? 학교가 왜 이렇게 흔들리지? 지진인가?!" },
            { name: "???", text: "야간 행군... 그런 힘든 걸 어떻게 해! 난 못 가! 도망칠 거야!!!", action: "bg-dim" },
            { name: playerName, text: "아니, 저 목소리는...? 선생님들이 학교 밖으로 도망치고 계시잖아?!" },
            { name: playerName, text: "이러다간 야간 행사가 취소될지도 몰라... 내가 직접 선생님들을 잡아서 데려와야겠어!" },
            { name: "시스템", text: "지도를 확인하여 도망친 선생님들을 모두 찾아내세요!", action: "end" }
        ];

        let currentStep = 0;
        let isTyping = false;
        let typingTimer = null;

        const typeWriter = (text, i, cb) => {
            if (i < text.length) {
                dialogueText.textContent = text.substring(0, i + 1);
                isTyping = true;
                typingTimer = setTimeout(() => typeWriter(text, i + 1, cb), 40);
            } else {
                isTyping = false;
                if (cb) cb();
            }
        };

        const nextDialogue = () => {
            if (isTyping) {
                // If already typing, skip to end
                clearTimeout(typingTimer);
                const step = scripts[currentStep - 1];
                dialogueText.textContent = step.text;
                isTyping = false;
                return;
            }

            if (currentStep >= scripts.length) {
                Storage.setSeenIntro();
                introScreen.onclick = null;
                introScreen.classList.add('hidden');
                this.startGame();
                return;
            }

            const step = scripts[currentStep];
            dialogueName.textContent = step.name;
            
            // Start typing
            typeWriter(step.text, 0);

            // 액션 처리
            if (step.action === "shake") {
                introBg.classList.add('intro-shake');
                introCharacter.classList.add('shaking');
                setTimeout(() => {
                    introBg.classList.remove('intro-shake');
                    introCharacter.classList.remove('shaking');
                }, 1000);
            } else if (step.action === "bg-dim") {
                introBg.style.filter = "brightness(0.2) blur(5px)";
            } else if (step.action === "end") {
                introBg.style.filter = "brightness(0.6)";
            }

            currentStep++;
        };

        // 첫 대사 실행
        nextDialogue();

        introScreen.onclick = () => {
            nextDialogue();
        };
    },

    startGame: function() {
        this.updatePlayerInfo();
        MapManager.init();
    },

    updatePlayerInfo: function() {
        const playerInfo = Storage.getPlayerInfo();
        const progress = Storage.getProgress();
        const itemCount = Storage.getItemCount();
        
        document.getElementById('playerName').textContent = playerInfo.name;
        document.getElementById('collectedCount').innerHTML = `<span>📚</span> ${progress.current}/${progress.total}`;
        const itemEl = document.getElementById('itemCount');
        if (itemEl) {
            itemEl.innerHTML = `<span>🎒</span> ${itemCount}`;
            itemEl.style.color = itemCount === 0 ? '#ff4757' : 'inherit';
        }

        const infoName = document.getElementById('infoPlayerName');
        const infoColl = document.getElementById('infoCollectedCount');
        const infoItem = document.getElementById('infoItemCount');
        
        if (infoName) infoName.textContent = playerInfo.name;
        if (infoColl) infoColl.textContent = `${progress.current} / ${progress.total}명`;
        if (infoItem) infoItem.textContent = `${itemCount}개`;
    },

    bindEvents: function() {
        document.getElementById('btnDex').addEventListener('click', () => {
            this.renderDex();
            document.getElementById('dexScreen').classList.remove('hidden');
        });

        document.getElementById('btnDexClose').addEventListener('click', () => {
            document.getElementById('dexScreen').classList.add('hidden');
        });

        document.getElementById('btnPlayerInfo').addEventListener('click', () => {
            this.updatePlayerInfo();
            document.getElementById('infoScreen').classList.remove('hidden');
        });

        document.getElementById('btnInfoClose').addEventListener('click', () => {
            document.getElementById('infoScreen').classList.add('hidden');
        });

        document.getElementById('btnSubmitResult').addEventListener('click', () => {
            this.submitResultToGoogleForm();
        });

        document.getElementById('btnReset').addEventListener('click', () => {
            if(confirm("정말 모든 도감과 아이템, 잡은 내역을 싹 초기화할까요?")) {
                localStorage.clear();
                location.reload(true);
            }
        });
    },

    renderDex: function() {
        const grid = document.getElementById('dexGrid');
        grid.innerHTML = '';
        
        const myDex = Storage.getDex();
        
        TEACHERS_DB.forEach(t => {
            const catchCount = myDex.filter(id => id === t.id).length;
            const isCaught = catchCount > 0;
            const card = document.createElement('div');
            
            let rClass = '';
            if (t.rarity === 'rare') rClass = 'rarity-rare';
            if (t.rarity === 'legendary') rClass = 'rarity-legendary';

            card.className = `dex-card ${!isCaught ? 'uncaught' : ''} ${rClass}`.trim();
            
            const imageHtml = isCaught 
                ? `<img src="${t.image}" alt="${t.name}">`
                : `<div class="unknown-avatar"><span>👤</span></div>`;

            card.innerHTML = `
                ${imageHtml}
                <div class="name">${isCaught ? t.name : '???'}</div>
            `;
            
            // 클릭 시 상세 모달 표시
            if (isCaught) {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    this.showDexDetail(t, catchCount);
                });
            }
            
            grid.appendChild(card);
        });
    },

    showDexDetail: function(t, catchCount) {
        // 기존 모달 제거
        const existing = document.getElementById('dexDetailModal');
        if (existing) existing.remove();

        let rarityBadge = '';
        if (t.rarity === 'rare') rarityBadge = '<span class="detail-badge rare">⭐ RARE</span>';
        if (t.rarity === 'legendary') rarityBadge = '<span class="detail-badge legendary">🌟 LEGENDARY</span>';

        const modal = document.createElement('div');
        modal.id = 'dexDetailModal';
        modal.className = 'dex-detail-overlay';
        modal.innerHTML = `
            <div class="dex-detail-box">
                <button class="dex-detail-close" id="btnDexDetailClose">✕</button>
                <img src="${t.image}" alt="${t.name}" class="dex-detail-img">
                <div class="dex-detail-name">${t.name}</div>
                <div class="dex-detail-type">${t.type}</div>
                ${rarityBadge}
                <div class="dex-detail-stats">
                    <div class="detail-stat-item">
                        <span class="detail-stat-label">포획 횟수</span>
                        <span class="detail-stat-value catch-count">${catchCount}회</span>
                    </div>
                    <div class="detail-stat-item">
                        <span class="detail-stat-label">📍 발견 장소</span>
                        <span class="detail-stat-value">${t.foundAt || '불명'}</span>
                    </div>
                </div>
                <div class="dex-detail-desc">"${t.desc}"</div>
            </div>
        `;

        document.body.appendChild(modal);

        // 닫기 버튼
        document.getElementById('btnDexDetailClose').addEventListener('click', () => modal.remove());
        // 배경 클릭 시 닫기
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },


    submitResultToGoogleForm: function() {
        const playerInfo = Storage.getPlayerInfo();
        const allCaughtIds = Storage.getDex(); // 잡은 전체 ID 목록 (중복 포함)
        
        // 등급별 '총 수집 횟수' 계산
        let normalCount = 0;
        let rareCount = 0;
        let legendaryCount = 0;

        allCaughtIds.forEach(id => {
            // TEACHERS_DB에서 해당 ID의 선생님 정보 찾기 (ID 형식을 문자로 통일해 비교)
            const t = TEACHERS_DB.find(teacher => String(teacher.id) === String(id));
            if (t) {
                if (t.rarity === 'rare') {
                    rareCount++;
                } else if (t.rarity === 'legendary') {
                    legendaryCount++;
                } else {
                    normalCount++; // rarity가 없거나 일반인 경우
                }
            }
        });

        // 도감 완료 여부 (이건 중복 제외하고 종류별로 체크)
        const uniqueCaughtIds = [...new Set(allCaughtIds)];
        const isComplete = uniqueCaughtIds.length === TEACHERS_DB.length ? "완료" : "미완료";

        // 백그라운드 전송용 URL (formResponse 사용)
        const SUBMIT_URL = "https://docs.google.com/forms/d/e/1FAIpQLSe2y30Y2VulGONjhTpHzT-PIiaSI7NqX8a2t9p63-v3G2riwg/formResponse";
        
        // 전송할 데이터 구성
        const params = new URLSearchParams();
        params.append("entry.247602473", playerInfo.id); // 학번만 전송
        params.append("entry.97218545", normalCount);
        params.append("entry.1933865499", rareCount);
        params.append("entry.1055895707", legendaryCount);
        params.append("entry.264404483", isComplete);

        if (confirm("상세 게임 결과를 관리자에게 즉시 전송하시겠습니까?")) {
            const btn = document.getElementById('btnSubmitResult');
            const originalText = btn.textContent;
            
            // 버튼 상태 변경
            btn.disabled = true;
            btn.textContent = "전송 중...";
            btn.style.opacity = "0.7";

            // fetch를 사용하여 백그라운드 전송
            fetch(SUBMIT_URL, {
                method: "POST",
                mode: "no-cors", // CORS 정책 우회
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            })
            .then(() => {
                alert("게임 결과가 성공적으로 관리자에게 전송되었습니다!");
                btn.textContent = "전송 완료 ✅";
                btn.style.background = "#bdc3c7";
                btn.style.opacity = "1";
            })
            .catch(err => {
                console.error("전송 오류:", err);
                alert("전송 중 오류가 발생했습니다. 다시 시도해 주세요.");
                btn.disabled = false;
                btn.textContent = originalText;
                btn.style.opacity = "1";
            });
        }
    }
};

// 페이지 로드 완료 시 앱 실행
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
