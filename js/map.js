// js/map.js

let map;
let playerMarker;
let teacherMarkers = [];
let pokestopMarkers = [];
let watchId;
let firstGPS = true; // 최초 GPS 수신 시 테스트 데이터 생성용
let encounterCircle; // 50m 반경 표시용 서클

const ENCOUNTER_DISTANCE = 50; // 조우 가능 거리 (50미터)

// Haversine 공식을 사용한 거리 계산 함수 (미터 단위 반환)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // 지구 반경 (미터)
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radicals
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; 
}

const MapManager = {
    init: function() {
        // 서울시청 기본 (GPS 잡기 전에 표시)
        // 지도의 기본 시야(줌 레벨 18). 수동으로 확대/축소를 자유롭게 조작할 수 있도록 허용합니다.
        map = L.map('map', { 
            zoomControl: false, // 복잡한 기본 +- 버튼은 가림
            dragging: true,
            scrollWheelZoom: true, 
            doubleClickZoom: true, 
            touchZoom: true, 
            boxZoom: true
        }).setView([37.5665, 126.9780], 18);

        // 지도의 디자인을 포켓몬고처럼 훨씬 깔끔하고 단순한 모던 스타일(CartoDB Voyager)로 변경합니다.
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            maxZoom: 19
        }).addTo(map);

        // 플레이어 커스텀 아이콘 (교복 입은 학생 모습)
        const playerIcon = L.divIcon({
            html: '<div style="border-radius:50%; width:40px; height:40px; border:3px solid #3498db; box-shadow: 0 0 10px rgba(52, 152, 219, 0.8);"><img src="img/student_avatar.png?v=3" style="width:100%; height:100%; border-radius:50%; background:white; object-fit:cover; object-position: top;"></div>',
            iconSize: [46, 46],
            iconAnchor: [23, 23], // 이미지 중앙을 기준점으로 설정
            className: 'player-icon'
        });

        playerMarker = L.marker([37.5665, 126.9780], {icon: playerIcon}).addTo(map);

        // 50m 반경 (조우 가능 구역) 표시선 추가
        encounterCircle = L.circle([37.5665, 126.9780], {
            color: '#e74c3c', // 빨간 선
            fillColor: '#e74c3c',
            fillOpacity: 0.1,
            weight: 3,
            dashArray: '5, 5', // 점선
            radius: ENCOUNTER_DISTANCE // 50m
        }).addTo(map);

        this.startGPS();
        this.renderSpawnPoints();
        
        // 내 위치 버튼 (내 위치로 가면서 축척도 원래대로 리셋)
        document.getElementById('btnRecenter').addEventListener('click', () => {
            const pos = playerMarker.getLatLng();
            map.setView(pos, 18);
        });
    },

    startGPS: function() {
        if (!navigator.geolocation) {
            alert("이 브라우저에서는 GPS를 지원하지 않습니다.");
            return;
        }

        watchId = navigator.geolocation.watchPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            if (firstGPS) {
                firstGPS = false;
                // this.renderSpawnPoints(); // 실제 데이터 렌더링 (초기에 1회 필요)
            }

            const newPos = [lat, lng];
            playerMarker.setLatLng(newPos);
            encounterCircle.setLatLng(newPos); // 반경 원도 같이 이동
            
            // 줌 레벨을 초기화하지 않고 현재 상태를 유지하며 위치만 이동
            map.panTo(newPos);

            this.checkEncounters(lat, lng);

        }, (error) => {
            console.warn(`GPS Error: ${error.message}`);
        }, {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        });
    },

    renderSpawnPoints: function() {
        // 기존 마커 제거
        teacherMarkers.forEach(m => map.removeLayer(m.marker));
        teacherMarkers = [];

        // data.js의 SPAWN_LOCATIONS 순회
        SPAWN_LOCATIONS.forEach((spawn, index) => {
            const teacher = getTeacherById(spawn.teacherId);
            if (!teacher) return;
            
            // 해당 위치(위도+경도)의 스폰 마커 고유 키
            const spawnKey = `${spawn.lat}_${spawn.lng}`;

            // 이 위치의 마커를 잡았으면 숨김 (같은 선생님이라도 다른 마커면 표시됨)
            if (Storage.isSpawnCaught(spawnKey)) return;
            
            let rarityClass = '';
            let zIndexPriority = 0;
            if (teacher.rarity === 'rare') { rarityClass = 'rarity-rare'; zIndexPriority = 100; }
            if (teacher.rarity === 'legendary') { rarityClass = 'rarity-legendary'; zIndexPriority = 1000; }

            const iconHtml = `<div class="${rarityClass}" style="border-radius:50%; width:40px; height:40px;"><img src="${teacher.image}" style="width:100%; height:100%; border-radius:50%; background:white;"></div>`;

            const icon = L.divIcon({
                html: iconHtml,
                iconSize: [40, 40],
                className: 'teacher-icon'
            });

            // 생성해두지만, 지도에 바로 추가(addTo)하지는 않음 (25m 이내일 때만 노출)
            const marker = L.marker([spawn.lat, spawn.lng], {icon: icon, zIndexOffset: zIndexPriority});
            
            marker.on('click', () => {
                const playerPos = playerMarker.getLatLng();
                const distance = calculateDistance(playerPos.lat, playerPos.lng, spawn.lat, spawn.lng);
                
                if (distance <= ENCOUNTER_DISTANCE) {
                    CatchManager.startEncounter(teacher, spawnKey);
                } else {
                    alert(`너무 멉니다! (${Math.floor(distance)}m 떨어짐. ${ENCOUNTER_DISTANCE}m 이내로 접근하세요.)`);
                }
            });

            teacherMarkers.push({
                index: index,
                marker: marker,
                data: spawn,
                isAdded: false // 지도 노출 여부
            });
        });

        // ------------------ 포켓스탑 렌더링 ------------------
        pokestopMarkers.forEach(m => map.removeLayer(m.marker));
        pokestopMarkers = [];

        POKESTOP_LOCATIONS.forEach((stop, index) => {
            const canUse = Storage.canUsePokestop(stop.id);
            const iconHtml = `<div style="width:40px; height:40px; 
                                        filter:${canUse ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' : 'grayscale(100%) opacity(50%)'};
                                        border: 3px solid #3498db;
                                        border-radius: 50%;
                                        background: white;
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        overflow: hidden;">
                                        <img src="로고.png?v=2" style="width:100%; height:auto; object-fit:contain;">
                                      </div>`;

            const icon = L.divIcon({ html: iconHtml, iconSize: [46, 46], iconAnchor: [23, 23], className: 'pokestop-icon' });
            const marker = L.marker([stop.lat, stop.lng], {icon: icon});
            marker.addTo(map); // 거리 제한 없이 항상 지도에 표시되도록 설정
            
            marker.on('click', () => {
                const playerPos = playerMarker.getLatLng();
                const distance = calculateDistance(playerPos.lat, playerPos.lng, stop.lat, stop.lng);
                
                if (distance <= ENCOUNTER_DISTANCE) {
                    if (Storage.canUsePokestop(stop.id)) {
                        Storage.addItems(10);
                        Storage.usePokestop(stop.id);
                        
                        // 아이템 획득 연출
                        const rewardEl = document.getElementById('itemReward');
                        rewardEl.classList.remove('hidden');
                        setTimeout(() => {
                            rewardEl.classList.add('hidden');
                        }, 1200);

                        App.updatePlayerInfo();
                        this.renderSpawnPoints(); 
                    } else {
                        // 쿨타임 안내는 간단한 토스트나 작은 알림이 좋지만 일단 유지하거나 커스텀 모달 사용
                        CatchManager.showResultModal("잠시만요!", "아직 아이템을 얻을 수 없습니다.\n5분 뒤에 다시 방문하세요!", "⏳");
                    }
                } else {
                    CatchManager.showResultModal("너무 멉니다!", `${Math.floor(distance)}m 떨어짐.\n${ENCOUNTER_DISTANCE}m 이내로 접근하세요.`, "📍");
                }
            });

            pokestopMarkers.push({
                index: index,
                marker: marker,
                data: stop,
                isAdded: false
            });
        });
        // -----------------------------------------------------
        
        // 다시 그렸을 때 내 주변만 노출되도록 즉시 갱신
        if (playerMarker) {
            const p = playerMarker.getLatLng();
            this.checkEncounters(p.lat, p.lng);
        }
    },

    checkEncounters: function(lat, lng) {
        // 플레이어 25m 반경 내에 들어온 마커만 지도에 표시
        teacherMarkers.forEach(m => {
            const distance = calculateDistance(lat, lng, m.data.lat, m.data.lng);
            if (distance <= ENCOUNTER_DISTANCE) {
                if (!m.isAdded) {
                    m.marker.addTo(map);
                    m.isAdded = true;
                }
            } else {
                // 25m를 벗어나면 다시 숨김
                if (m.isAdded) {
                    map.removeLayer(m.marker);
                    m.isAdded = false;
                }
            }
        });
        // 포켓스탑은 거리와 상관없이 항상 노출되도록 위에 선언했으므로 
        // 여기서 거리에 따른 노출/숨김 처리를 삭제했습니다.
    }
};
