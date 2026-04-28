let localDB = []; // 편집중인 선생님 데이터
let spawnMarkers = []; // 지도에 찍힌 스폰 정보 (종류: teacher / pokestop)
let editingId = null; // 현재 수정 중인 선생님 ID

// 맵 객체
let map;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 기존 data.js 정보 로드
    loadExistingData();

    // 2. UI 및 이벤트 초기화
    setupTabs();
    setupDBForm();
    initMap();
    setupMapSidebar();
    setupExport();

    // 초기 렌더링
    renderTeacherGrid();
    renderMapSelect();
});

// data.js의 데이터를 처음에 불러와서 초기화
function loadExistingData() {
    if (typeof TEACHERS_DB !== 'undefined') {
        localDB = JSON.parse(JSON.stringify(TEACHERS_DB));
    }
    if (typeof SPAWN_LOCATIONS !== 'undefined') {
        SPAWN_LOCATIONS.forEach(s => {
            const t = localDB.find(x => x.id === s.teacherId);
            const labelStr = t ? t.name : '알수없음';
            spawnMarkers.push({ id: Date.now() + Math.random(), lat: s.lat, lng: s.lng, type: 'teacher', teacherId: s.teacherId, label: labelStr });
        });
    }
    if (typeof POKESTOP_LOCATIONS !== 'undefined') {
        POKESTOP_LOCATIONS.forEach(p => {
            spawnMarkers.push({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, type: 'pokestop', label: p.name });
        });
    }
}

/* ================== 탭 제어 ================== */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');

            // 맵 탭으로 이동시 leaflet 리사이징 버그 방지
            if (tab.dataset.target === 'tab-map' && map) {
                setTimeout(() => map.invalidateSize(), 200);
            }
        });
    });
}

/* ================== DB 탭 (선생님 추가/수정) ================== */
let currentBase64Image = "https://api.dicebear.com/7.x/notionists/svg?seed=default";

function setupDBForm() {
    // 슬라이더 텍스트 실시간 연동
    const probInput = document.getElementById('tBaseProb');
    const probLabel = document.getElementById('tProbLabel');
    probInput.addEventListener('input', () => {
        probLabel.textContent = probInput.value + '%';
    });

    // 이미지 파일 업로드 시 Base64로 즉시 변환
    const fileInput = document.getElementById('tImageFile');
    const preview = document.getElementById('tImagePreview');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            if (!editingId) {
                preview.style.display = 'none';
                currentBase64Image = "https://api.dicebear.com/7.x/notionists/svg?seed=new";
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            currentBase64Image = event.target.result; // Data URL 형식의 엄청 긴 문자열
            preview.src = currentBase64Image;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    // 추가/수정 버튼
    document.getElementById('btnAddTeacher').addEventListener('click', () => {
        const name = document.getElementById('tName').value.trim();
        const typeStr = document.getElementById('tType').value.trim();
        if (!name || !typeStr) {
            alert("이름과 타입을 입력해주세요!");
            return;
        }

        if (editingId !== null) {
            // 수정 모드
            const idx = localDB.findIndex(t => t.id === editingId);
            if (idx > -1) {
                localDB[idx] = {
                    ...localDB[idx],
                    name: name,
                    type: typeStr,
                    desc: document.getElementById('tDesc').value.trim(),
                    foundAt: document.getElementById('tFoundAt').value.trim(),
                    baseProb: parseInt(document.getElementById('tBaseProb').value) / 100,
                    preferredItem: document.getElementById('tPreferredItem').value,
                    rarity: document.getElementById('tRarity').value,
                    image: currentBase64Image
                };
                alert(`${name} 선생님 정보가 수정되었습니다!`);
            }
            editingId = null;
            document.getElementById('btnAddTeacher').textContent = '선생님 추가하기';
            document.querySelector('.db-form-panel h3').textContent = '새 선생님 추가';
        } else {
            // 추가 모드
            const newId = localDB.length > 0 ? Math.max(...localDB.map(t => t.id)) + 1 : 1;

            const teacher = {
                id: newId,
                name: name,
                type: typeStr,
                desc: document.getElementById('tDesc').value.trim(),
                foundAt: document.getElementById('tFoundAt').value.trim(),
                baseProb: parseInt(document.getElementById('tBaseProb').value) / 100, // 0.1 ~ 0.9 변환
                preferredItem: document.getElementById('tPreferredItem').value,
                rarity: document.getElementById('tRarity').value,
                image: currentBase64Image
            };

            localDB.push(teacher);
            alert(`${name} 선생님 정보가 추가되었습니다!`);
        }
        
        resetForm();
        renderTeacherGrid();
        renderMapSelect(); // 연동된 지도 드롭다운 갱신
    });

    // 취소 버튼 (수정 모드에서만 보임)
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'btnCancelEdit';
    cancelBtn.textContent = '취소';
    cancelBtn.style.marginTop = '10px';
    cancelBtn.style.background = '#95a5a6';
    cancelBtn.style.display = 'none';
    cancelBtn.addEventListener('click', () => {
        editingId = null;
        resetForm();
        document.getElementById('btnAddTeacher').textContent = '선생님 추가하기';
        document.querySelector('.db-form-panel h3').textContent = '새 선생님 추가';
        cancelBtn.style.display = 'none';
    });
    document.getElementById('btnAddTeacher').after(cancelBtn);
}

function resetForm() {
    const preview = document.getElementById('tImagePreview');
    document.getElementById('tName').value = '';
    document.getElementById('tType').value = '';
    document.getElementById('tDesc').value = '';
    document.getElementById('tFoundAt').value = '';
    document.getElementById('tPreferredItem').value = '';
    document.getElementById('tRarity').value = 'normal';
    document.getElementById('tImageFile').value = '';
    document.getElementById('tBaseProb').value = 50;
    document.getElementById('tProbLabel').textContent = '50%';
    preview.style.display = 'none';
    currentBase64Image = `https://api.dicebear.com/7.x/notionists/svg?seed=${Date.now()}`;
    
    const cancelBtn = document.getElementById('btnCancelEdit');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function renderTeacherGrid() {
    const grid = document.getElementById('teacherGrid');
    grid.innerHTML = '';
    
    localDB.forEach((t) => {
        let rColor = "#eee";
        if(t.rarity === 'rare') rColor = "#9b59b6";
        if(t.rarity === 'legendary') rColor = "#f1c40f";

        const card = document.createElement('div');
        card.className = 'teacher-card';
        card.style.borderColor = rColor;
        if(t.rarity !== 'normal') card.style.borderWidth = '2px';
        
        card.innerHTML = `
            <img src="${t.image}" alt="img" style="border-color:${rColor}">
            <div style="font-weight:bold; font-size:14px;">${t.name} ${t.rarity==='legendary'?'🌟':''}</div>
            <div style="font-size:12px; color:#555;">[${t.type}]</div>
            <div style="font-size:11px; margin-top:5px;">기본 확률: ${Math.round(t.baseProb * 100)}%</div>
            ${t.preferredItem ? `<div style="font-size:11px; color:#e74c3c;">❤ 선호: ${t.preferredItem}</div>` : ''}
            <div style="margin-top:10px; display:flex; gap:5px; justify-content:center;">
                <button class="edit-btn" data-id="${t.id}" style="background:#3498db; width:auto; padding:5px 10px; font-size:12px;">수정</button>
                <button class="danger delete-btn" data-id="${t.id}">삭제</button>
            </div>
        `;
        grid.appendChild(card);
    });

    // 수정 버튼 이벤트
    grid.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            const teacher = localDB.find(t => t.id === id);
            if (teacher) {
                editingId = id;
                document.getElementById('tName').value = teacher.name;
                document.getElementById('tType').value = teacher.type;
                document.getElementById('tDesc').value = teacher.desc || '';
                document.getElementById('tFoundAt').value = teacher.foundAt || '';
                document.getElementById('tBaseProb').value = Math.round(teacher.baseProb * 100);
                document.getElementById('tProbLabel').textContent = Math.round(teacher.baseProb * 100) + '%';
                document.getElementById('tPreferredItem').value = teacher.preferredItem || '';
                document.getElementById('tRarity').value = teacher.rarity || 'normal';
                
                const preview = document.getElementById('tImagePreview');
                preview.src = teacher.image;
                preview.style.display = 'block';
                currentBase64Image = teacher.image;

                document.getElementById('btnAddTeacher').textContent = '변경사항 저장';
                document.querySelector('.db-form-panel h3').textContent = '선생님 정보 수정';
                document.getElementById('btnCancelEdit').style.display = 'block';
                
                // 폼 상단으로 스크롤
                document.querySelector('.db-form-panel').scrollTop = 0;
            }
        });
    });

    // 삭제 버튼 이벤트
    grid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            const teacher = localDB.find(t => t.id === id);
            if(confirm(`"${teacher.name}" 데이터를 삭제하시겠습니까? (지도상 스폰 마커도 꼬일 수 있으니 주의하세요)`)) {
                localDB = localDB.filter(t => t.id !== id);
                renderTeacherGrid();
                renderMapSelect();
            }
        });
    });
}

function renderMapSelect() {
    const select = document.getElementById('mapTeacherSelect');
    select.innerHTML = '';
    localDB.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `[${t.type}] ${t.name}`;
        select.appendChild(opt);
    });
}

/* ================== MAP 탭 (지도 배치) ================== */
function initMap() {
    map = L.map('map').setView([37.5665, 126.9780], 17);
    
    // 게임과 동일한 CartoDB Voyager 타일 레이어 적용
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            map.setView([position.coords.latitude, position.coords.longitude], 18);
        });
    }

    // 기존 데이터 렌더링
    spawnMarkers.forEach(m => {
        const popupContent = `
            <div style="text-align:center;">
                <b>${m.label}</b><br>
                <button onclick="deleteMarkerById(${m.id})" style="margin-top:8px; background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">마커 삭제</button>
            </div>
        `;

        if (m.type === 'teacher') {
            const teacher = localDB.find(t => t.id === m.teacherId);
            if (teacher) {
                let rarityClass = '';
                if (teacher.rarity === 'rare') rarityClass = 'rarity-rare';
                if (teacher.rarity === 'legendary') rarityClass = 'rarity-legendary';

                const iconHtml = `<div class="${rarityClass}" style="border-radius:50%; width:40px; height:40px; overflow:hidden; border:2px solid white; background:white;"><img src="${teacher.image}" style="width:100%; height:100%; object-fit:cover;"></div>`;
                const icon = L.divIcon({
                    html: iconHtml,
                    iconSize: [40, 40],
                    className: 'teacher-icon'
                });
                m.marker = L.marker([m.lat, m.lng], {icon: icon}).addTo(map).bindPopup(popupContent);
            } else {
                m.marker = L.marker([m.lat, m.lng]).addTo(map).bindPopup(popupContent);
            }
        } else {
            const iconHtml = `<div style="width:40px; height:40px; border: 3px solid #3498db; border-radius: 50%; background: white; display: flex; justify-content: center; align-items: center; overflow: hidden;"><img src="로고.png?v=2" style="width:100%; height:auto; object-fit:contain;"></div>`;
            const icon = L.divIcon({ html: iconHtml, iconSize: [46, 46], iconAnchor: [23, 23], className: 'pokestop-icon' });
            m.marker = L.marker([m.lat, m.lng], {icon: icon}).addTo(map).bindPopup(popupContent);
        }
    });
    updateLocationListUI();

    map.on('click', (e) => {
        const lat = parseFloat(e.latlng.lat.toFixed(6));
        const lng = parseFloat(e.latlng.lng.toFixed(6));
        
        const typeRadios = document.getElementsByName('spawnType');
        let selectedType = 'teacher';
        for (let radio of typeRadios) {
            if (radio.checked) selectedType = radio.value;
        }

        let markerData = { id: Date.now(), lat: lat, lng: lng, type: selectedType };
        
        const popupContent = `
            <div style="text-align:center;">
                <b>${selectedType === 'teacher' ? '???' : '포켓스탑'}</b><br>
                <button onclick="deleteMarkerById(${markerData.id})" style="margin-top:8px; background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">마커 삭제</button>
            </div>
        `;

        if (selectedType === 'teacher') {
            const select = document.getElementById('mapTeacherSelect');
            if (select.options.length === 0) {
                alert("등록된 선생님이 없습니다. 1번 탭에서 선생님을 먼저 추가해 주세요.");
                return;
            }
            markerData.teacherId = parseInt(select.value);
            markerData.label = select.options[select.selectedIndex].text;
            
            const teacher = localDB.find(t => t.id === markerData.teacherId);
            let rarityClass = '';
            if (teacher.rarity === 'rare') rarityClass = 'rarity-rare';
            if (teacher.rarity === 'legendary') rarityClass = 'rarity-legendary';

            const iconHtml = `<div class="${rarityClass}" style="border-radius:50%; width:40px; height:40px; overflow:hidden; border:2px solid white; background:white;"><img src="${teacher.image}" style="width:100%; height:100%; object-fit:cover;"></div>`;
            const icon = L.divIcon({
                html: iconHtml,
                iconSize: [40, 40],
                className: 'teacher-icon'
            });

            // 생성 시 팝업 내용 업데이트 (ID가 확정된 후)
            const finalPopupContent = `
                <div style="text-align:center;">
                    <b>${markerData.label}</b><br>
                    <button onclick="deleteMarkerById(${markerData.id})" style="margin-top:8px; background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">마커 삭제</button>
                </div>
            `;
            markerData.marker = L.marker([lat, lng], {icon: icon}).addTo(map).bindPopup(finalPopupContent);
            
        } else {
            // Pokestop
            const name = document.getElementById('mapPokestopName').value.trim() || '포켓스탑';
            markerData.name = name;
            markerData.label = name;
            
            const iconHtml = `<div style="width:40px; height:40px; border: 3px solid #3498db; border-radius: 50%; background: white; display: flex; justify-content: center; align-items: center; overflow: hidden;"><img src="로고.png?v=2" style="width:100%; height:auto; object-fit:contain;"></div>`;
            const icon = L.divIcon({ html: iconHtml, iconSize: [46, 46], iconAnchor: [23, 23], className: 'pokestop-icon' });
            
            const finalPopupContent = `
                <div style="text-align:center;">
                    <b>${name}</b><br>
                    <button onclick="deleteMarkerById(${markerData.id})" style="margin-top:8px; background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">마커 삭제</button>
                </div>
            `;
            markerData.marker = L.marker([lat, lng], {icon: icon}).addTo(map).bindPopup(finalPopupContent);
        }

        spawnMarkers.push(markerData);
        updateLocationListUI();
    });
}

// 글로벌 삭제 함수 (팝업 내 onclick 호출용)
window.deleteMarkerById = function(id) {
    const index = spawnMarkers.findIndex(x => x.id === id);
    if (index > -1) {
        map.removeLayer(spawnMarkers[index].marker);
        spawnMarkers.splice(index, 1);
        updateLocationListUI();
    }
};

function setupMapSidebar() {
    // 라디오 버튼 전환 시 UI 변경
    const radios = document.getElementsByName('spawnType');
    radios.forEach(r => {
        r.addEventListener('change', () => {
            if (r.value === 'teacher') {
                document.getElementById('teacherSelectBlock').style.display = 'block';
                document.getElementById('pokestopNameBlock').style.display = 'none';
            } else {
                document.getElementById('teacherSelectBlock').style.display = 'none';
                document.getElementById('pokestopNameBlock').style.display = 'block';
            }
        });
    });

    // 지도 초기화 버튼
    document.getElementById('btnClearMap').addEventListener('click', () => {
        if(confirm("지도에 찍힌 모든 마커를 초기화하시겠습니까?")) {
            spawnMarkers.forEach(m => map.removeLayer(m.marker));
            spawnMarkers = [];
            updateLocationListUI();
        }
    });
}

function updateLocationListUI() {
    const list = document.getElementById('locationList');
    list.innerHTML = '';
    document.getElementById('markerCount').textContent = spawnMarkers.length;

    spawnMarkers.forEach(m => {
        const div = document.createElement('div');
        div.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:8px; border:1px solid #ddd; margin-bottom:5px; border-radius:4px;";
        
        const typeText = m.type === 'teacher' ? '🧑‍🏫' : '<div style="width:24px; height:24px; border: 2px solid #3498db; border-radius: 50%; background: white; display: inline-flex; justify-content: center; align-items: center; overflow: hidden; vertical-align:middle; margin-right:4px;"><img src="로고.png?v=2" style="width:100%; height:auto; object-fit:contain;"></div>';
        div.innerHTML = `
            <span>${typeText} ${m.label} <br><span style="color:#888;">(${m.lat}, ${m.lng})</span></span>
            <button class="danger" style="border:none; border-radius:4px; padding:5px; cursor:pointer;" data-id="${m.id}">삭제</button>
        `;
        list.appendChild(div);
    });

    // 삭제 이벤트 처리
    list.querySelectorAll('.danger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = Number(e.currentTarget.dataset.id);
            const index = spawnMarkers.findIndex(x => x.id === id);
            if(index > -1) {
                map.removeLayer(spawnMarkers[index].marker);
                spawnMarkers.splice(index, 1);
                updateLocationListUI();
            }
        });
    });
}

/* ================== Export 탭 (코드 생성) ================== */
function setupExport() {
    document.getElementById('btnGenerateCode').addEventListener('click', () => {
        // 1. TEACHERS_DB 코드 포맷팅
        const dbJson = JSON.stringify(localDB, null, 4);
        let outputCode = `// ==== js/data.js (생성된 코드 전체 덮어쓰기) ==== \n\n`;
        outputCode += `const TEACHERS_DB = ${dbJson};\n\n`;

        // 2. SPAWN_LOCATIONS (teacher 타입만 분리)
        const teachersOut = spawnMarkers
            .filter(m => m.type === 'teacher')
            .map(m => ({ lat: m.lat, lng: m.lng, teacherId: m.teacherId }));
        
        outputCode += `let SPAWN_LOCATIONS = ${JSON.stringify(teachersOut, null, 4)};\n\n`;

        // 3. POKESTOP_LOCATIONS (pokestop 타입만 분리)
        const pokestopsOut = spawnMarkers
            .filter(m => m.type === 'pokestop')
            .map(m => ({ id: m.id, name: m.name, lat: m.lat, lng: m.lng }));

        outputCode += `let POKESTOP_LOCATIONS = ${JSON.stringify(pokestopsOut, null, 4)};\n\n`;

        // 4. 헬퍼 함수 추가 (이거 안 넣으면 index.html이 망가짐)
        outputCode += `// ID로 선생님 데이터를 찾는 헬퍼 함수
function getTeacherById(id) {
    return TEACHERS_DB.find(t => t.id === parseInt(id));
}\n`;

        const txtArea = document.getElementById('exportArea');
        txtArea.value = outputCode;
        
        // 클립보드 복사
        txtArea.select();
        document.execCommand('copy');
        alert("코드가 복사되었습니다! \njs/data.js 파일을 열고 기존 코드를 완전히 지운 뒤에 붙여넣기 하세요.");
    });
}
