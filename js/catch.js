// js/catch.js — 3D 포물선 투척 + 명중 판정 시스템

const CATCH_ITEMS = [
    { name: "커피", icon: "☕", probBonus: 0 },
    { name: "컴퓨터용 사인펜", icon: "🖊️", probBonus: 0 },
    { name: "빵점짜리 시험지", icon: "📄", probBonus: -0.2 },
    { name: "교무 수첩", icon: "📓", probBonus: 0 }
];

const CatchManager = {
    currentTarget: null,
    currentItem: null,
    currentSpawnKey: null,

    // 스와이프 상태
    isDragging: false,
    startX: 0, startY: 0,
    lastX: 0, lastY: 0,
    velocityX: 0, velocityY: 0,
    lastTime: 0,

    // 투척 애니메이션 상태
    isThrowing: false,
    animFrame: null,

    // DOM
    itemEl: null,
    canvas: null,
    ctx: null,
    field: null,

    init: function() {
        this.itemEl = document.getElementById('throwItem');
        this.canvas = document.getElementById('throwCanvas');
        this.field = document.getElementById('catchField');

        // 도망 버튼
        document.getElementById('btnRun').addEventListener('click', () => {
            this.closeScreen();
        });

        // 터치
        this.itemEl.addEventListener('touchstart', this.onPointerDown.bind(this), {passive: false});
        document.addEventListener('touchmove', this.onPointerMove.bind(this), {passive: false});
        document.addEventListener('touchend', this.onPointerUp.bind(this));

        // 마우스
        this.itemEl.addEventListener('mousedown', this.onPointerDown.bind(this));
        document.addEventListener('mousemove', this.onPointerMove.bind(this));
        document.addEventListener('mouseup', this.onPointerUp.bind(this));
    },

    // ===================== 조우 시작 =====================
    startEncounter: function(teacher, spawnKey) {
        this.currentTarget = teacher;
        this.currentSpawnKey = spawnKey;

        // 랜덤 배경 설정 (포획1.png, 포획2.png, 포획3.png)
        const bgNum = Math.floor(Math.random() * 3) + 1;
        const bgEl = document.getElementById('catch3dBg');
        if (bgEl) {
            bgEl.style.backgroundImage = `url('img/포획${bgNum}.jpg')`;
        }

        // 이름
        const nameEls = document.querySelectorAll('#targetName');
        nameEls.forEach(el => el.textContent = teacher.name);
        document.getElementById('targetName3d').textContent = teacher.name;

        // 이미지
        const sprite = document.getElementById('targetSprite');
        sprite.style.backgroundImage = `url(${teacher.image})`;

        // Rarity 이펙트
        const catchScreen = document.getElementById('catchScreen');
        catchScreen.className = 'overlay';
        sprite.className = 'sprite';

        if (teacher.rarity === 'rare') {
            sprite.classList.add('rarity-rare');
        } else if (teacher.rarity === 'legendary') {
            sprite.classList.add('rarity-legendary');
            catchScreen.classList.add('catch-screen-legendary', 'shake-screen');
        }

        // 결과 텍스트 초기화
        const resultEl = document.getElementById('catch3d-result');
        resultEl.className = 'catch3d-result';

        // 아이템 준비
        this.resetItem();

        // 캔버스 사이즈 설정
        this.setupCanvas();

        catchScreen.classList.remove('hidden');
    },

    setupCanvas: function() {
        const rect = this.field.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.ctx = this.canvas.getContext('2d');
    },

    closeScreen: function() {
        document.getElementById('catchScreen').classList.add('hidden');
        this.currentTarget = null;
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
    },

    resetItem: function() {
        this.isThrowing = false;
        this.isDragging = false;

        this.itemEl.className = 'throw-item-3d';
        this.itemEl.style.transform = 'translateX(-50%)';

        // 이전과 반드시 다른 아이템이 나오도록 강제
        let newItem;
        do {
            newItem = CATCH_ITEMS[Math.floor(Math.random() * CATCH_ITEMS.length)];
        } while (CATCH_ITEMS.length > 1 && this.currentItem && newItem.name === this.currentItem.name);
        this.currentItem = newItem;
        this.itemEl.innerHTML = this.currentItem.icon;

        // HUD 갱신
        const nameEl = document.getElementById('hudItemName');
        const iconEl = document.getElementById('hudItemIcon');
        if (nameEl) nameEl.textContent = this.currentItem.name;
        if (iconEl) iconEl.textContent = this.currentItem.icon;

        // 캔버스 클리어
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 결과 텍스트 초기화
        const resultEl = document.getElementById('catch3d-result');
        resultEl.className = 'catch3d-result';
    },

    // ===================== 포인터 이벤트 =====================
    getXY: function(e) {
        if (e.touches && e.touches.length > 0)
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0)
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    },

    onPointerDown: function(e) {
        if (this.isThrowing) return;
        e.preventDefault();
        const pt = this.getXY(e);
        this.isDragging = true;
        this.startX = pt.x;
        this.startY = pt.y;
        this.lastX = pt.x;
        this.lastY = pt.y;
        this.velocityX = 0;
        this.velocityY = 0;
        this.lastTime = Date.now();
        this.itemEl.classList.add('dragging');
    },

    onPointerMove: function(e) {
        if (!this.isDragging || this.isThrowing) return;
        e.preventDefault();
        const pt = this.getXY(e);
        const now = Date.now();
        const dt = Math.max(now - this.lastTime, 1);

        this.velocityX = (pt.x - this.lastX) / dt;
        this.velocityY = (pt.y - this.lastY) / dt;

        this.lastX = pt.x;
        this.lastY = pt.y;
        this.lastTime = now;

        // 실시간 드래그 이동 (약간의 올라감 표현)
        const dx = pt.x - this.startX;
        const dy = pt.y - this.startY;
        if (dy < 0) {
            // 살짝 올려서 시각적 피드백
            const scale = Math.max(0.6, 1 + dy / 600);
            this.itemEl.style.transform = `translate(calc(-50% + ${dx * 0.3}px), ${dy * 0.5}px) scale(${scale})`;
        }
    },

    onPointerUp: function(e) {
        if (!this.isDragging || this.isThrowing) return;
        this.isDragging = false;
        this.itemEl.classList.remove('dragging');

        const pt = this.getXY(e);
        const dy = pt.y - this.startY;
        const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);

        // 충분히 위로 스와이프 했는가?
        if (dy < -60 && speed > 0.3) {
            this.throwBall(this.velocityX, this.velocityY);
        } else {
            // 원위치
            this.itemEl.style.transform = 'translateX(-50%)';
        }
    },

    // ===================== 3D 포물선 투척 =====================
    throwBall: function(vx, vy) {
        if (Storage.getItemCount() <= 0) {
            alert("아이템이 부족합니다! 주변의 포켓스탑을 방문하여 얻으세요.");
            this.itemEl.style.transform = 'translateX(-50%)';
            return;
        }

        // 아이템 차감
        Storage.consumeItem();
        App.updatePlayerInfo();

        this.isThrowing = true;
        this.itemEl.classList.add('hidden-ball');

        // 타깃(선생님) 위치 계산
        const fieldRect = this.field.getBoundingClientRect();
        const targetWrap = document.getElementById('catch3d-target-wrap');
        const targetRect = targetWrap.getBoundingClientRect();
        const targetCX = targetRect.left + targetRect.width / 2 - fieldRect.left;
        const targetCY = targetRect.top + targetRect.height / 2 - fieldRect.top;

        // 볼 시작 위치 (화면 하단 중앙)
        const startX = this.canvas.width / 2;
        const startY = this.canvas.height * 0.82;

        // 투척 방향 결정
        const throwPowerMult = Math.min(Math.abs(vy) * 800, 1200);
        const lateralDrift = vx * 400; // 좌우 흔들림

        // 도착 지점 (타깃 근처 + 약간의 좌우 오차)
        const endX = targetCX + lateralDrift;
        const endY = targetCY;

        // 포물선 중간 꼭짓점
        const midX = (startX + endX) / 2 + lateralDrift * 0.5;
        const midY = Math.min(startY, endY) - throwPowerMult * 0.35;

        // 명중 여부 결정: 볼이 타깃 범위 안에 착지하는지
        const hitRadius = 55; // 타깃 명중 판정 반경 (px)
        const distToTarget = Math.sqrt((endX - targetCX) ** 2 + (endY - targetCY) ** 2);
        const isHit = distToTarget < hitRadius;

        // 애니메이션 시작
        const totalFrames = 40;
        let frame = 0;
        const self = this;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const emoji = this.currentItem.icon;

        function animate() {
            frame++;
            const t = frame / totalFrames;

            // Bezier Quadratic 곡선 (시작 → 꼭짓점 → 도착)
            const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * midX + t ** 2 * endX;
            const y = (1 - t) ** 2 * startY + 2 * (1 - t) * t * midY + t ** 2 * endY;

            // 원근감: 멀어질수록 작아짐
            const scale = 1.0 - t * 0.55;
            const rotation = t * 720; // 회전 (deg)

            // 프레임 새로 그리기
            ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);

            // 그림자
            ctx.save();
            ctx.beginPath();
            const shadowY = startY - (startY - endY) * t * 0.2;
            ctx.fillStyle = `rgba(0,0,0,${0.15 * (1 - t)})`;
            ctx.ellipse(x, shadowY + 10, 18 * scale, 6 * scale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 이모지(볼) 그리기
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(scale, scale);
            ctx.font = '44px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emoji, 0, 0);
            ctx.restore();

            if (frame < totalFrames) {
                self.animFrame = requestAnimationFrame(animate);
            } else {
                // 애니메이션 끝 → 판정
                setTimeout(() => {
                    ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
                    self.handleThrowResult(isHit);
                }, 100);
            }
        }

        this.animFrame = requestAnimationFrame(animate);
    },

    // ===================== 명중 판정 처리 =====================
    handleThrowResult: function(isHit) {
        const resultEl = document.getElementById('catch3d-result');

        if (!isHit) {
            // 빗나감! 아이템만 소모됨
            resultEl.textContent = '빗나갔다!';
            resultEl.className = 'catch3d-result show miss';

            setTimeout(() => {
                this.resetItem();
            }, 1200);
            return;
        }

        // 명중! → 포획 시도
        resultEl.textContent = '명중!';
        resultEl.className = 'catch3d-result show hit';

        const sprite = document.getElementById('targetSprite');
        sprite.classList.add('shaking');

        setTimeout(() => {
            sprite.classList.remove('shaking');
            resultEl.className = 'catch3d-result';

            this.processCatch();
        }, 1500);
    },

    // ===================== 포획 확률 판정 =====================
    processCatch: function() {
        const baseProb = this.currentTarget.baseProb !== undefined ? this.currentTarget.baseProb : 0.5;
        let finalProb = baseProb + this.currentItem.probBonus;

        let isPreferred = false;
        if (this.currentTarget.preferredItem && this.currentTarget.preferredItem === this.currentItem.name) {
            finalProb += 0.05;
            isPreferred = true;
        }

        finalProb = Math.max(0.1, Math.min(0.95, finalProb));
        const success = Math.random() < finalProb;

        if (success) {
            let title = "포획 성공!";
            let msg = `[${this.currentItem.name}]을(를) 받은 ${this.currentTarget.name} 선생님을 도감에 등록했다!`;
            let icon = "✨";

            if (isPreferred) {
                title = "대성공!";
                msg = `선생님이 가장 좋아하는 [${this.currentItem.name}]이라서 쉽게 잡았습니다!`;
                icon = "❤️";
            }

            Storage.addTeacherToDex(this.currentTarget.id);
            Storage.markSpawnAsCaught(this.currentSpawnKey);

            if (this.currentTarget.rarity === 'legendary') {
                const flash = document.getElementById('flashEffect');
                flash.className = 'flash-whiteout';
                setTimeout(() => {
                    flash.className = '';
                    this.showResultModal("🌟 기적!", msg, "🎉", () => {
                        this.finalizeCatchSuccess();
                    });
                }, 1400);
            } else {
                this.showResultModal(title, msg, icon, () => {
                    this.finalizeCatchSuccess();
                });
            }
        } else {
            let msg = `아앗! 선생님이 [${this.currentItem.name}]을(를) 거부했습니다.`;
            if (isPreferred) msg = `아깝다! 선생님이 가장 좋아하는 [${this.currentItem.name}]이었지만 실패했습니다.`;

            this.showResultModal("실패...", msg, "😢", () => {
                this.resetItem();
            });
        }
    },

    showResultModal: function(title, msg, icon, onConfirm) {
        const modal = document.getElementById('resultModal');
        const titleEl = document.getElementById('resultTitle');
        const msgEl = document.getElementById('resultMsg');
        const iconEl = document.getElementById('resultIcon');
        const btn = document.getElementById('btnResultClose');

        titleEl.textContent = title;
        msgEl.textContent = msg;
        iconEl.textContent = icon;

        modal.classList.remove('hidden');

        btn.onclick = () => {
            modal.classList.add('hidden');
            if (onConfirm) onConfirm();
        };
    },

    finalizeCatchSuccess: function() {
        MapManager.renderSpawnPoints();
        App.updatePlayerInfo();
        this.closeScreen();
    }
};
