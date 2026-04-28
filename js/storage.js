// js/storage.js

const Storage = {
    DEX_KEY: 'daesung_go_dex',
    ITEM_KEY: 'daesung_go_items',
    COOLDOWN_KEY: 'daesung_go_cooldowns',
    SPAWN_KEY: 'daesung_go_spawns',
    INTRO_KEY: 'daesung_go_intro',
    PLAYER_ID_KEY: 'daesung_go_player_id',
    PLAYER_NAME_KEY: 'daesung_go_player_name',

    // 플레이어 정보 저장
    setPlayerInfo(id, name) {
        localStorage.setItem(this.PLAYER_ID_KEY, id);
        localStorage.setItem(this.PLAYER_NAME_KEY, name);
    },

    // 플레이어 정보 로드
    getPlayerInfo() {
        return {
            id: localStorage.getItem(this.PLAYER_ID_KEY),
            name: localStorage.getItem(this.PLAYER_NAME_KEY)
        };
    },

    // 도감 배열 반환 ([1, 3] 형태로 획득한 아이디들의 배열)
    getDex() {
        const dex = localStorage.getItem(this.DEX_KEY);
        return dex ? JSON.parse(dex) : [];
    },

    // 선생님을 도감에 추가 (여러 번 잡아도 기록되도록 중복 저장 허용)
    addTeacherToDex(teacherId) {
        const dex = this.getDex();
        dex.push(teacherId);
        localStorage.setItem(this.DEX_KEY, JSON.stringify(dex));
        return true; 
    },

    // 전체 중 몇 종류를 잡았는지 반환 (중복 제외한 유니크 수)
    getProgress() {
        const dex = this.getDex();
        const uniqueDex = [...new Set(dex)];
        const current = uniqueDex.length;
        const total = TEACHERS_DB.length;
        return { current, total };
    },

    // --- 특정 맵 마커(스폰) 숨김 처리 ---
    getSpawns() {
        const spawns = localStorage.getItem(this.SPAWN_KEY);
        return spawns ? JSON.parse(spawns) : [];
    },

    isSpawnCaught(spawnKey) {
        return this.getSpawns().includes(spawnKey);
    },

    markSpawnAsCaught(spawnKey) {
        if (!spawnKey) return;
        const spawns = this.getSpawns();
        if (!spawns.includes(spawnKey)) {
            spawns.push(spawnKey);
            localStorage.setItem(this.SPAWN_KEY, JSON.stringify(spawns));
        }
    },

    // --- 아이템 시스템 ---
    getItemCount() {
        const count = localStorage.getItem(this.ITEM_KEY);
        // 최초 접속이면 30개 지급
        if (count === null) {
            this.setItemCount(30);
            return 30;
        }
        return parseInt(count);
    },

    setItemCount(n) {
        localStorage.setItem(this.ITEM_KEY, n);
    },

    consumeItem() {
        let count = this.getItemCount();
        if (count > 0) {
            this.setItemCount(count - 1);
            return true;
        }
        return false;
    },

    addItems(n) {
        let count = this.getItemCount();
        this.setItemCount(count + n);
    },

    // --- 포켓스탑 쿨타임 ---
    getCooldowns() {
        const cd = localStorage.getItem(this.COOLDOWN_KEY);
        return cd ? JSON.parse(cd) : {};
    },

    canUsePokestop(stopId) {
        const cooldowns = this.getCooldowns();
        const lastUsed = cooldowns[stopId];
        if (!lastUsed) return true;
        
        // 5분 = 300,000 ms
        const timePassed = Date.now() - lastUsed;
        return timePassed > 5 * 60 * 1000;
    },

    usePokestop(stopId) {
        const cooldowns = this.getCooldowns();
        cooldowns[stopId] = Date.now();
        localStorage.setItem(this.COOLDOWN_KEY, JSON.stringify(cooldowns));
    },

    hasSeenIntro() {
        return localStorage.getItem(this.INTRO_KEY) === 'true';
    },

    setSeenIntro() {
        localStorage.setItem(this.INTRO_KEY, 'true');
    }
};
