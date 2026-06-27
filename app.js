const memoriaFijos = {}, memoriaCorridos = {}, memoriaCentenas = {}, memoriaParles = {};
let totalLista = 0, totalBote = 0;
const input = document.getElementById('main-input');

document.getElementById('search-date').valueAsDate = new Date();

// --- CARGA AUTOMÁTICA DE DATOS DE LA JORNADA ---
async function cargarJornadaActual() {
    const hoy = new Date().toISOString().split('T')[0];
    
    document.getElementById('box-fijos').innerHTML = "";
    document.getElementById('box-parles').innerHTML = "";
    totalLista = 0; totalBote = 0;
    updateCounters();

    const { data: jugadas, error: errJ } = await _supabase.from('jugadas')
        .select('*')
        .eq('usuario', currentUsuario)
        .gte('created_at', `${hoy}T00:00:00Z`)
        .lte('created_at', `${hoy}T23:59:59Z`);

    if (!errJ && jugadas) {
        jugadas.forEach(j => {
            if (j.jornada === currentJornadaGlobal || (!j.jornada)) { 
                totalLista += j.costo_total || 0;
                if (j.tipo === 'fijo') {
                    memoriaFijos[j.numeros] = (memoriaFijos[j.numeros] || 0) + (j.monto_fijo || 0);
                    memoriaCorridos[j.numeros] = (memoriaCorridos[j.numeros] || 0) + (j.monto_corrido || 0);
                    let el = createFijoElement(j.numeros, j.monto_fijo, j.monto_corrido, false);
                    el.classList.add('processed');
                    attachLongPressDelete(el, j.costo_total, false, 'fijo', j.numeros, j.monto_fijo, j.monto_corrido, 'jugadas');
                } else if (j.tipo === 'centena') {
                    memoriaCentenas[j.numeros] = (memoriaCentenas[j.numeros] || 0) + (j.monto_fijo || 0);
                    let el = createCentenaElement(j.numeros, j.monto_fijo, false);
                    el.classList.add('processed');
                    attachLongPressDelete(el, j.costo_total, false, 'centena', j.numeros, j.monto_fijo, 0, 'jugadas');
                } else if (j.tipo === 'parle') {
                    memoriaParles[j.numeros] = (memoriaParles[j.numeros] || 0) + (j.monto_fijo || 0);
                    let el = createParleVerticalElement(j.numeros.split('-'), j.monto_fijo, false);
                    el.classList.add('processed');
                    attachLongPressDelete(el, j.costo_total, false, 'parle', j.numeros, j.monto_fijo, 0, 'jugadas');
                }
            }
        });
    }

    const { data: botes, error: errB } = await _supabase.from('botes')
        .select('*')
        .eq('usuario', currentUsuario)
        .gte('created_at', `${hoy}T00:00:00Z`)
        .lte('created_at', `${hoy}T23:59:59Z`);

    if (!errB && botes) {
        botes.forEach(b => {
            if (b.jornada === currentJornadaGlobal || (!b.jornada)) {
                totalBote += b.costo_total || 0;
                if (b.tipo === 'fijo') {
                    let el = createFijoElement(b.numeros, b.monto_fijo, b.monto_corrido, true);
                    el.classList.add('processed');
                    attachLongPressDelete(el, b.costo_total, true, 'fijo', b.numeros, 0, 0, 'botes');
                } else if (b.tipo === 'centena') {
                    let el = createCentenaElement(b.numeros, b.monto_fijo, true);
                    el.classList.add('processed');
                    attachLongPressDelete(el, b.costo_total, true, 'centena', b.numeros, 0, 0, 'botes');
                } else if (b.tipo === 'parle') {
                    let el = createParleVerticalElement(b.numeros.split('-'), b.monto_fijo, true);
                    el.classList.add('processed');
                    attachLongPressDelete(el, b.costo_total, true, 'parle', b.numeros, 0, 0, 'botes');
                }
            }
        });
    }
    updateCounters();
}

// --- CONSULTAR LISTAS GUARDADAS ---
async function fetchSavedLists() {
    const dateVal = document.getElementById('search-date').value;
    const resBox = document.getElementById('search-results');
    const footerBox = document.getElementById('search-summary-footer');
    if(!dateVal) { alert("Por favor seleccione un día en el calendario."); return; }

    resBox.innerHTML = "Buscando en Supabase...";
    footerBox.style.display = 'none';

    let tiroCentena = "", tiroFijo = "", tiroCorrido1 = "", tiroCorrido2 = "";
    const { data: tData, error: tErr } = await _supabase.from('tiros')
        .select('*')
        .eq('fecha', dateVal)
        .eq('jornada', selectedSearchTurn)
        .maybeSingle();

    if (!tErr && tData && tData.resultado) {
        let parts = tData.resultado.trim().split(/\s+/);
        if (parts[0] && parts[0].length === 3) {
            tiroCentena = parts[0];
            tiroFijo = parts[0].substring(1);
        }
        if (parts[1]) tiroCorrido1 = parts[1];
        if (parts[2]) tiroCorrido2 = parts[2];
    }

    const { data: jugadas } = await _supabase.from('jugadas')
        .select('*').eq('usuario', currentUsuario)
        .gte('created_at', `${dateVal}T00:00:00Z`).lte('created_at', `${dateVal}T23:59:59Z`)
        .eq('jornada', selectedSearchTurn);

    const { data: botes } = await _supabase.from('botes')
        .select('*').eq('usuario', currentUsuario)
        .gte('created_at', `${dateVal}T00:00:00Z`).lte('created_at', `${dateVal}T23:59:59Z`)
        .eq('jornada', selectedSearchTurn);

    if((!jugadas || jugadas.length === 0) && (!botes || botes.length === 0)) {
        resBox.innerHTML = `<span style="color:#b91c1c;">No se encontraron registros para el ${dateVal} en la jornada ${selectedSearchTurn}.</span>`;
        return;
    }

    let acumLimpio = 0;
    let acumPremio = 0;
    let htmlFijos = "", htmlParles = "", htmlCentenas = "";

    function evaluarFijoCorrido(numero, mFijo, mCorrido) {
        let p = 0;
        let esLimitado = listaNumerosLimitadosGlobal.includes(numero);
        let multFijo = esLimitado ? 50 : 75;
        let multCorrido = esLimitado ? 20 : 25;

        if (tiroFijo && numero === tiroFijo) {
            p += (mFijo * multFijo) + (mCorrido * multCorrido);
        }
        if ((tiroCorrido1 && numero === tiroCorrido1) || (tiroCorrido2 && numero === tiroCorrido2)) {
            p += (mCorrido * multCorrido);
        }
        return p;
    }

    function evaluarCentena(numero, monto) {
        if (tiroCentena && numero === tiroCentena) { return monto * 400; }
        return 0;
    }

    function evaluarParle(pKey, monto) {
        let ganadores = [];
        if(tiroFijo) ganadores.push(tiroFijo);
        if(tiroCorrido1) ganadores.push(tiroCorrido1);
        if(tiroCorrido2) ganadores.push(tiroCorrido2);

        let reqNumbers = pKey.split('-');
        let aciertos = reqNumbers.every(num => ganadores.includes(num));
        
        if (aciertos && reqNumbers.length >= 2) {
            let tieneLimitado = reqNumbers.some(num => listaNumerosLimitadosGlobal.includes(num));
            let multParle = tieneLimitado ? 550 : 1100;
            return monto * multParle;
        }
        return 0;
    }

    if (jugadas) {
        jugadas.forEach(j => {
            acumLimpio += j.costo_total || 0;
            if (j.tipo === 'fijo') {
                let premioItem = evaluarFijoCorrido(j.numeros, j.monto_fijo, j.monto_corrido);
                acumPremio += premioItem;
                htmlFijos += `• <strong>${j.numeros}</strong> -> Fijo: $${j.monto_fijo} | Corrido: $${j.monto_corrido} ${premioItem > 0 ? `<span class="text-green">[+$${premioItem}]</span>` : ''}<br>`;
            } else if (j.tipo === 'centena') {
                let premioItem = evaluarCentena(j.numeros, j.monto_fijo);
                acumPremio += premioItem;
                htmlCentenas += `• <strong>${j.numeros}</strong> -> Centena: $${j.monto_fijo} ${premioItem > 0 ? `<span class="text-green">[+$${premioItem}]</span>` : ''}<br>`;
            } else if (j.tipo === 'parle') {
                let premioItem = evaluarParle(j.numeros, j.monto_fijo);
                acumPremio += premioItem;
                htmlParles += `• <strong>${j.numeros}</strong> -> Parle: $${j.monto_fijo} ${premioItem > 0 ? `<span class="text-green">[+$${premioItem}]</span>` : ''}<br>`;
            }
        });
    }

    if (botes) {
        botes.forEach(b => {
            acumLimpio += b.costo_total || 0;
            if (b.tipo === 'fijo') {
                let premioItem = evaluarFijoCorrido(b.numeros, b.monto_fijo, b.monto_corrido);
                acumPremio += premioItem;
                htmlFijos += `• <strong>${b.numeros} <span class="text-red">[Bote]</span></strong> -> Fijo: $${b.monto_fijo} | Corrido: $${b.monto_corrido} ${premioItem > 0 ? `<span class="text-green">[+$${premioItem}]</span>` : ''}<br>`;
            } else if (b.tipo === 'centena') {
                let premioItem = evaluarCentena(b.numeros, b.monto_fijo);
                acumPremio += premioItem;
                htmlCentenas += `• <strong>${b.numeros} <span class="text-red">[Bote]</span></strong> -> Centena: $${b.monto_fijo} ${premioItem > 0 ? `<span class="text-green">[+$${premioItem}]</span>` : ''}<br>`;
            } else if (b.tipo === 'parle') {
                let premioItem = evaluarParle(b.numeros, b.monto_fijo);
                acumPremio += premioItem;
                htmlParles += `• <strong>${b.numeros} <span class="text-red">[Bote]</span></strong> -> Parle: $${b.monto_fijo} ${premioItem > 0 ? `<span class="text-green">[+$${premioItem}]</span>` : ''}<br>`;
            }
        });
    }

    let htmlString = `<strong>Jornada: ${selectedSearchTurn}</strong><br>`;
    if(tData && tData.resultado) {
        htmlString += `<span class="text-green">Tiro Oficial: <strong>${tData.resultado}</strong></span><br>`;
    } else {
        htmlString += `<span style="color:#6b7280; font-style:italic;">Sin tiro oficial registrado aún para este turno.</span><br>`;
    }
    htmlString += `<hr style='margin:6px 0; border: 0; border-top: 1px solid #ccc;'>`;

    if (htmlFijos) htmlString += `<span style="text-decoration: underline; font-weight:bold;">FIJOS Y CORRIDOS:</span><br>${htmlFijos}<br>`;
    if (htmlParles) htmlString += `<span style="text-decoration: underline; font-weight:bold;">PARLES:</span><br>${htmlParles}<br>`;
    if (htmlCentenas) htmlString += `<span style="text-decoration: underline; font-weight:bold;">CENTENAS:</span><br>${htmlCentenas}`;

    resBox.innerHTML = htmlString;
    let totalNeto = acumLimpio - acumPremio;

    document.getElementById('sum-limpio').innerText = `$${acumLimpio.toFixed(2)}`;
    document.getElementById('sum-premio').innerText = `$${acumPremio.toFixed(2)}`;
    
    let totalElement = document.getElementById('sum-total');
    if (totalNeto < 0) {
        totalElement.innerText = `Ganas: $${Math.abs(totalNeto).toFixed(2)}`;
        totalElement.className = "text-green";
    } else {
        totalElement.innerText = `Pierdes: $${totalNeto.toFixed(2)}`;
        totalElement.className = "text-red";
    }
    footerBox.style.display = 'block';
}

// --- CONTROL MENÚS Y MODALES ---
function toggleMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('dots-menu');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}
function openModal(id) {
    document.getElementById('dots-menu').style.display = 'none';
    document.getElementById('modal-container').style.display = 'flex';
    document.querySelectorAll('.modal-box').forEach(b => b.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-container').style.display = 'none'; }
document.addEventListener('click', () => { document.getElementById('dots-menu').style.display = 'none'; });

async function fetchLimitados() {
    const { data } = await _supabase.from('limitados').select('*');
    const container = document.getElementById('db-limitados-list');
    listaNumerosLimitadosGlobal = [];
    if (!data || data.length === 0) { container.innerHTML = "No hay números bloqueados administrativamente."; return; }
    
    data.forEach(item => { if(item.numero) listaNumerosLimitadosGlobal.push(item.numero); });
    container.innerHTML = data.map(item => `• <strong>${item.numero}</strong>: ${item.motivo}`).join('<br>');
}

async function initClock() {
    const icon = document.getElementById('solar-icon');
    const btnSend = document.getElementById('btn-main-send');
    const clockEl = document.getElementById('digital-clock');

    // Variables internas para mantener el tiempo corriendo segundo a segundo
    let localHour = 0;
    let localMinute = 0;
    let localSecond = 0;
    let clockInterval = null;

    // Estado inicial seguro
    if (icon) icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> CARGANDO...';
    if (btnSend) { 
        btnSend.disabled = true; 
        btnSend.style.opacity = "0.4"; 
        btnSend.style.cursor = "not-allowed"; 
    }
    currentJornadaGlobal = "CERRADO"; 

    // Función 1: Actualiza el diseño del reloj digital en la pantalla segundo a segundo
    function updateDigitalClock() {
        if (!clockEl) return;

        // Avanzar el tiempo un segundo
        localSecond++;
        if (localSecond >= 60) { localSecond = 0; localMinute++; }
        if (localMinute >= 60) { localMinute = 0; localHour++; }
        if (localHour >= 24) { localHour = 0; }

        // Formatear a formato de 12 horas (AM/PM) para Cuba
        const ampm = localHour >= 12 ? 'PM' : 'AM';
        let displayHour = localHour % 12;
        displayHour = displayHour ? displayHour : 12; // El 0 se convierte en 12

        // Añadir ceros a la izquierda para que se vea limpio (03:05:09)
        const strHours = String(displayHour).padStart(2, '0');
        const strMinutes = String(localMinute).padStart(2, '0');
        const strSeconds = String(localSecond).padStart(2, '0');

        // Pintar la hora en el HTML
        clockEl.innerText = `${strHours}:${strMinutes}:${strSeconds} ${ampm}`;
    }

    // Función 2: Sincroniza las reglas de bloqueo con el servidor de internet
    async function syncWithServer() {
        try {
            const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=America/Havana');
            if (!response.ok) throw new Error('Servidor de hora no disponible');
            
            const data = await response.json();
            
            // Sincronizamos nuestro reloj interno con la hora exacta de internet
            localHour = parseInt(data.hour, 10);
            localMinute = parseInt(data.minute, 10);
function initClock() {
    const icon = document.getElementById('solar-icon');
    const btnSend = document.getElementById('btn-main-send');
    const clockEl = document.getElementById('digital-clock');

    // Inicializamos las variables con una hora por defecto aproximada por seguridad
    let localHour = new Date().getHours();
    let localMinute = new Date().getMinutes();
    let localSecond = new Date().getSeconds();

    // 1. INICIAR EL RELOJ DIGITAL DE INMEDIATO (Síncrono)
    // Esto corre al instante en milisegundos, permitiendo que auth.js trabaje sin trabar la sesión
    setInterval(function updateDigitalClock() {
        localSecond++;
        if (localSecond >= 60) { localSecond = 0; localMinute++; }
        if (localMinute >= 60) { localMinute = 0; localHour++; }
        if (localHour >= 24) { localHour = 0; }

        if (!clockEl) return;
        
        const ampm = localHour >= 12 ? 'PM' : 'AM';
        let displayHour = localHour % 12;
        displayHour = displayHour ? displayHour : 12;

        const strHours = String(displayHour).padStart(2, '0');
        const strMinutes = String(localMinute).padStart(2, '0');
        const strSeconds = String(localSecond).padStart(2, '0');

        clockEl.innerText = `${strHours}:${strMinutes}:${strSeconds} ${ampm}`;
    }, 1000);

    // Estado inicial seguro en la interfaz mientras se verifica el servidor
    if (icon) icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> VERIFICANDO...';
    currentJornadaGlobal = "CERRADO"; 

    // 2. FUNCIÓN DE SINCRONIZACIÓN ASÍNCRONA CON INTERNET
    async function syncWithServer() {
        try {
            const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=America/Havana');
            if (!response.ok) throw new Error('Servidor de hora fuera de servicio');
            
            const data = await response.json();
            
            // Sincronizamos las variables del segundero con el servidor de Cuba de forma silenciosa
            localHour = parseInt(data.hour, 10);
            localMinute = parseInt(data.minute, 10);
            localSecond = parseInt(data.second, 10);

            const min = (localHour * 60) + localMinute;

            // VALIDACIÓN DE JORNADAS DE RECOJIDA
            if (min >= 360 && min <= 805) { 
                if(icon) icon.innerHTML = '<i class="fa-solid fa-sun"></i> DIA'; 
                currentJornadaGlobal = "DIA"; 
                if(btnSend) { btnSend.disabled = false; btnSend.style.opacity = "1"; btnSend.style.cursor = "pointer"; }
            } else if (min >= 840 && min <= 1290) { 
                if(icon) icon.innerHTML = '<i class="fa-solid fa-moon"></i> NOCHE'; 
                currentJornadaGlobal = "NOCHE"; 
                if(btnSend) { btnSend.disabled = false; btnSend.style.opacity = "1"; btnSend.style.cursor = "pointer"; }
            } else { 
                if(icon) icon.innerHTML = '<i class="fa-solid fa-clock"></i> CERRADO'; 
                currentJornadaGlobal = "CERRADO"; 
                if(btnSend) { btnSend.disabled = true; btnSend.style.opacity = "0.4"; btnSend.style.cursor = "not-allowed"; }
            }

        } catch (error) {
            console.error("Error sincronizando hora oficial:", error);
            // Si el internet falla, mantenemos el botón cerrado por seguridad anti-trampas
            if(icon) icon.innerHTML = '<i class="fa-solid fa-wifi"></i> DESCONECTADO';
            if(btnSend) { 
                btnSend.disabled = true; 
                btnSend.style.opacity = "0.4"; 
                btnSend.style.cursor = "not-allowed"; 
            }
            currentJornadaGlobal = "CERRADO";
        }
    }

    // Ejecutamos la sincronización en segundo plano sin usar 'await' al inicio
    // para que no interrumpa la lectura de la sesión de Supabase
    syncWithServer(); 
    
    // Sigue comprobando el servidor cada 45 segundos para controlar los cortes de tiradas
    setInterval(syncWithServer, 45000); 
}







function toggleKeyboardVisibility() {
    const kb = document.getElementById('kb-grid-element');
    kb.classList.toggle('minimized');
}

function ensureKeyboardVisible() {
    const kb = document.getElementById('kb-grid-element');
    kb.classList.remove('minimized');
}

function selectSearchTurn(turn) {
    selectedSearchTurn = turn;
    document.getElementById('btn-turn-dia').classList.toggle('active', turn === 'DIA');
    document.getElementById('btn-turn-noche').classList.toggle('active', turn === 'NOCHE');
}

// --- TECLADO VIRTUAL ---
function kPress(key) {
    if (currentJornadaGlobal === "CERRADO") return;
    if (key === 'del') { input.value = input.value.slice(0, -1); return; }
    let val = input.value;
    if (!isNaN(key)) {
        let segments = val.split(/[\-,\,]/);
        let lastPart = segments[segments.length - 1] || "";
        if(lastPart.includes(' ')) {
            let spaceParts = lastPart.split(' ');
            lastPart = spaceParts[spaceParts.length - 1];
        }
        if (lastPart.length === 2 && !val.includes('-') && !val.endsWith('-') && !val.endsWith(',') && !val.endsWith(' ')) {
            val += ',';
        }
    }
    input.value = val + key;
}

// --- ENVIAR JUGADAS ---
async function guardarEnSupabase(tabla, payload, elementHtml) {
    if (currentJornadaGlobal === "CERRADO") { alert("La sección está cerrada."); return; }
    payload.jornada = currentJornadaGlobal;
    const { status, error } = await _supabase.from(tabla).insert([payload]);
    if (!error && (status === 201 || status === 200)) {
        if (elementHtml) elementHtml.classList.add('processed');
    }
}

async function borrarDeSupabase(tabla, numQuery) {
    if (currentJornadaGlobal === "CERRADO") return;
    await _supabase.from(tabla).delete().eq('numeros', numQuery).eq('usuario', currentUsuario).eq('jornada', currentJornadaGlobal);
}

function attachLongPressDelete(element, costValue, isBote, typeKey, numKey, fAmt = 0, cAmt = 0, dbTabla = 'jugadas') {
    let timer;
    function start() {
        timer = setTimeout(() => {
            if (currentJornadaGlobal === "CERRADO") {
                alert("La sección está cerrada. No se pueden modificar ni borrar datos.");
                return;
            }
            if (confirm("¿Desea borrar esta jugada?")) {
                if(isBote) { totalBote -= costValue; if (totalBote < 0) totalBote = 0; } 
                else {
                    totalLista -= costValue; if (totalLista < 0) totalLista = 0;
                    if (typeKey === 'fijo') {
                        memoriaFijos[numKey] = (memoriaFijos[numKey] || 0) - fAmt;
                        memoriaCorridos[numKey] = (memoriaCorridos[numKey] || 0) - cAmt;
                    } else if (typeKey === 'centena') {
                        memoriaCentenas[numKey] = (memoriaCentenas[numKey] || 0) - fAmt;
                    } else if (typeKey === 'parle') {
                        memoriaParles[numKey] = (memoriaParles[numKey] || 0) - fAmt;
                    }
                }
                borrarDeSupabase(dbTabla, numKey);
                updateCounters();
                element.remove();
            }
        }, 1500); 
    }
    function cancel() { clearTimeout(timer); }
    element.addEventListener('mousedown', start); element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('mouseup', cancel); element.addEventListener('mouseleave', cancel); element.addEventListener('touchend', cancel);
}

// ... Continúa debajo con la segmentación de comandos ...
function sendPlay() {
    if (currentJornadaGlobal === "CERRADO") return;

    let query = input.value.trim();
    if (!query || !query.includes('-')) return;

    let indexDash = query.indexOf('-');
    let leftSide = query.substring(0, indexDash).trim();
    let rightSide = query.substring(indexDash + 1).trim();

    let amounts = rightSide.split('-');
    let mFijo = parseInt(amounts[0]) || 0; 
    let mCorrido = parseInt(amounts[1]) || 0;

    if (leftSide.includes(' ')) {
        let spaceParts = leftSide.split(/\s+/);
        if (spaceParts.length === 2 && spaceParts[1].length === 1) {
            let centenaUnida = spaceParts[1] + spaceParts[0]; 
            processCentena(centenaUnida, mFijo);
            input.value = ""; return;
        }
    }

    let tokens = leftSide.split(',');
    let finalNumbers = [];
    tokens.forEach(t => {
        let cleanT = t.trim();
        if(cleanT.includes('*')) {
            if(cleanT.startsWith('*')) {
                let unit = cleanT.replace('*', '');
                for(let i=0; i<=9; i++) finalNumbers.push(`${i}${unit}`);
            } else if(cleanT.endsWith('*')) {
                let dec = cleanT.replace('*', '');
                for(let i=0; i<=9; i++) finalNumbers.push(`${dec}${i}`);
            }
        } else if(cleanT.length > 0) { finalNumbers.push(cleanT); }
    });

    if (tokens.length === 1 && (tokens[0].length === 2 || tokens[0].includes('*'))) {
        finalNumbers.forEach(num => processFijo(num, mFijo, mCorrido));
    } else {
        if (finalNumbers.length === 1 && finalNumbers[0].length === 3) {
            processCentena(finalNumbers[0], mFijo);
        } else if (finalNumbers.length >= 2) {
            processParle(finalNumbers, mFijo);
        }
    }
    input.value = "";
}

function processFijo(num, fijo, corrido) {
    let acumuladoF = memoriaFijos[num] || 0;
    let acumuladoC = memoriaCorridos[num] || 0;
    let fLista = 0, fBote = 0, cLista = 0, cBote = 0;

    if (acumuladoF >= 500) { fBote = fijo; } 
    else if (acumuladoF + fijo > 500) { fLista = 500 - acumuladoF; fBote = fijo - fLista; } 
    else { fLista = fijo; }

    if (acumuladoC >= 500) { cBote = corrido; } 
    else if (acumuladoC + corrido > 500) { cLista = 500 - acumuladoC; cBote = corrido - cLista; } 
    else { cLista = corrido; }

    memoriaFijos[num] = acumuladoF + fLista;
    memoriaCorridos[num] = acumuladoC + cLista;

    if (fLista > 0 || cLista > 0) {
        let costLista = (fLista + cLista) * 0.8;
        let el = createFijoElement(num, fLista, cLista, false);
        totalLista += costLista;
        attachLongPressDelete(el, costLista, false, 'fijo', num, fLista, cLista, 'jugadas');
        guardarEnSupabase('jugadas', { usuario: currentUsuario, tipo: 'fijo', numeros: num, monto_fijo: fLista, monto_corrido: cLista, costo_total: costLista }, el);
    }
    if (fBote > 0 || cBote > 0) {
        let costBote = (fBote + cBote) * 0.8;
        let elBote = createFijoElement(num, fBote, cBote, true);
        totalBote += costBote;
        attachLongPressDelete(elBote, costBote, true, 'fijo', num, 0, 0, 'botes');
        guardarEnSupabase('botes', { usuario: currentUsuario, tipo: 'fijo', numeros: num, monto_fijo: fBote, monto_corrido: cBote, costo_total: costBote }, elBote);
    }
    updateCounters();
}

function processCentena(num, monto) {
    let acumulado = memoriaCentenas[num] || 0;
    let cLista = 0, cBote = 0;

    if (acumulado >= 50) { cBote = monto; } 
    else if (acumulado + monto > 50) { cLista = 50 - acumulado; cBote = monto - cLista; } 
    else { cLista = monto; }

    memoriaCentenas[num] = acumulado + cLista;

    if (cLista > 0) {
        let el = createCentenaElement(num, cLista, false);
        totalLista += cLista;
        attachLongPressDelete(el, cLista, false, 'centena', num, cLista, 0, 'jugadas');
        guardarEnSupabase('jugadas', { usuario: currentUsuario, tipo: 'centena', numeros: num, monto_fijo: cLista, costo_total: cLista }, el);
    }
    if (cBote > 0) {
        let elBote = createCentenaElement(num, cBote, true);
        totalBote += cBote;
        attachLongPressDelete(elBote, cBote, true, 'centena', num, 0, 0, 'botes');
        guardarEnSupabase('botes', { usuario: currentUsuario, tipo: 'centena', numeros: num, monto_fijo: cBote, costo_total: cBote }, elBote);
    }
    updateCounters();
}

function processParle(numbers, monto) {
    let pKey = numbers.slice().sort().join('-');
    let acumulado = memoriaParles[pKey] || 0;
    let pLista = 0, pBote = 0;

    if (acumulado >= 50) { pBote = monto; } 
    else if (acumulado + monto > 50) { pLista = 50 - acumulado; pBote = monto - pLista; } 
    else { pLista = monto; }

    memoriaParles[pKey] = acumulado + pLista;
    let combs = (numbers.length * (numbers.length - 1)) / 2;

    if (pLista > 0) {
        let costLista = (combs * pLista) * 0.7;
        let el = createParleVerticalElement(numbers, pLista, false);
        totalLista += costLista;
        attachLongPressDelete(el, costLista, false, 'parle', pKey, pLista, 0, 'jugadas');
        guardarEnSupabase('jugadas', { usuario: currentUsuario, tipo: 'parle', numeros: pKey, monto_fijo: pLista, costo_total: costLista }, el);
    }
    if (pBote > 0) {
        let costBote = (combs * pBote) * 0.7;
        let elBote = createParleVerticalElement(numbers, pBote, true);
        totalBote += costBote;
        attachLongPressDelete(elBote, costBote, true, 'parle', pKey, 0, 0, 'botes');
        guardarEnSupabase('botes', { usuario: currentUsuario, tipo: 'parle', numeros: pKey, monto_fijo: pBote, costo_total: costBote }, elBote);
    }
    updateCounters();
}

document.addEventListener('keyup', (e) => {
    if (e.key === "Enter") sendPlay();
});

function updateCounters() {
    document.getElementById('lbl-limpio-lista').innerText = totalLista.toFixed(2);
    document.getElementById('lbl-limpio-bote').innerText = totalBote.toFixed(2);
}

function createFijoElement(num, fijo, corrido, isBote) {
    const container = document.getElementById('box-fijos');
    const div = document.createElement('div'); div.className = "row-item fijo-row";
    let bubbleStyle = isBote ? "amount-bubble bote-style" : "amount-bubble";
    let boteLabel = isBote ? "<span class='bote-tag'>[Bote]</span>" : "";
    div.innerHTML = `<div><span>${num}</span>${boteLabel}</div> <span class="${bubbleStyle}">${fijo}</span> <span class="${bubbleStyle}">${corrido > 0 ? corrido : 0}</span>`;
    container.prepend(div); return div;
}

function createCentenaElement(num, monto, isBote) {
    const container = document.getElementById('box-parles');
    const div = document.createElement('div'); div.className = "row-item parle-row";
    let bubbleStyle = isBote ? "amount-bubble bote-style" : "amount-bubble";
    let boteLabel = isBote ? "<span class='bote-tag'>[Bote]</span>" : "";
    div.innerHTML = `<div class="centena-horizontal-block"><span>${num}</span>${boteLabel}</div><div class="parle-right-amount"><span class="${bubbleStyle}">${monto}</span></div>`;
    container.prepend(div); return div;
}

function createParleVerticalElement(numbers, monto, isBote) {
    const container = document.getElementById('box-parles');
    const div = document.createElement('div'); div.className = "row-item parle-row";
    let bubbleStyle = isBote ? "amount-bubble bote-style" : "amount-bubble";
    let linesHtml = ""; numbers.forEach(num => { linesHtml += `<span>${num}</span>`; });
    if(isBote) linesHtml += `<span class='bote-tag'>[Bote]</span>`;
    div.innerHTML = `<div class="parle-vertical-numbers">${linesHtml}</div><div class="parle-right-amount"><span class="${bubbleStyle}">${monto}</span></div>`;
    container.prepend(div); return div;
}
