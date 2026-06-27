// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = "https://ydpzblxjmmflzgsgfpmx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Zp2oQAowai67A_QYrH0Ukw_aLPSf3U-";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUsuario = "";
let currentJornadaGlobal = "DIA"; 
let selectedSearchTurn = "DIA";   
let listaNumerosLimitadosGlobal = []; 
let deferredPrompt = null;

// --- SISTEMA DE CONTROL DE SESIÓN PERSISTENTE ---
window.addEventListener('DOMContentLoaded', () => {
    initClock(); 
    verificarSesionGuardada();
});

function verificarSesionGuardada() {
    const sesionUsuario = localStorage.getItem('kb_session_user');
    const sesionJornada = localStorage.getItem('kb_session_jornada');
    const hoyFecha = new Date().toISOString().split('T')[0];
    const sesionFecha = localStorage.getItem('kb_session_fecha');

    if (sesionUsuario && sesionJornada === currentJornadaGlobal && sesionFecha === hoyFecha) {
        entrarDirectoAplicacion(sesionUsuario);
    } else {
        localStorage.removeItem('kb_session_user');
        localStorage.removeItem('kb_session_jornada');
        localStorage.removeItem('kb_session_fecha');
    }
}

async function entrarDirectoAplicacion(usuario) {
    currentUsuario = usuario;
    document.getElementById('auth-box').style.display = 'none';
    document.querySelectorAll('.billiard-ball').forEach(b => b.style.display = 'none');
    document.getElementById('main-app').style.display = 'flex';
    
    await fetchLimitados();
    await cargarJornadaActual();
}

function cerrarSesionManual() {
    localStorage.removeItem('kb_session_user');
    localStorage.removeItem('kb_session_jornada');
    localStorage.removeItem('kb_session_fecha');
    location.reload();
}

// --- MANEJO DE INSTALACIÓN (PWA) ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btn-install-app');
    if (btnInstall) btnInstall.style.display = 'flex';
});

function triggerAppInstallation() {
    if (!deferredPrompt) {
        alert("La aplicación ya se encuentra instalada o su navegador no soporta instalaciones directas.");
        return;
    }
    document.getElementById('dots-menu').style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            document.getElementById('btn-install-app').style.display = 'none';
        }
        deferredPrompt = null;
    });
}

function toggleForm(view) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (view === 'register') {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        registerForm.style.display = 'flex';
    } else {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        loginForm.style.display = 'flex';
    }
}

function togglePasswordVisibility(id) {
    const el = document.getElementById(id);
    const icon = el.nextElementSibling;
    if (el.type === "password") { el.type = "text"; icon.classList.replace('fa-eye-slash', 'fa-eye'); } 
    else { el.type = "password"; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
}

async function loginReal() {
    const u = document.getElementById('log-user').value.trim();
    const c = document.getElementById('log-pass').value.trim();
    const btn = document.getElementById('btn-login-submit');
    if(!u || !c) { alert("Escribe el usuario y la clave"); return; }
    
    btn.disabled = true;
    const { data, error } = await _supabase.from('usuarios').select('*').eq('usuario', u).eq('clave', c);
    
    if (error || !data || data.length === 0) {
        alert("Usuario o clave incorrectos en la base de datos.");
        btn.disabled = false;
    } else {
        localStorage.setItem('kb_session_user', u);
        localStorage.setItem('kb_session_jornada', currentJornadaGlobal);
        localStorage.setItem('kb_session_fecha', new Date().toISOString().split('T')[0]);
        
        entrarDirectoAplicacion(u);
    }
}

async function registroReal() {
    const u = document.getElementById('reg-user').value.trim();
    const c = document.getElementById('reg-pass').value.trim();
    const btn = document.getElementById('btn-register-submit');
    if(!u || !c) { alert("Completa los campos obligatorios"); return; }

    btn.disabled = true;
    const { status, error } = await _supabase.from('usuarios').insert([{ usuario: u, clave: c }]);
    if(!error && status === 201) {
        alert("Usuario registrado con éxito. Ya puedes iniciar sesión.");
        toggleForm('login');
    } else {
        alert("El usuario ya existe o hubo un error al registrar.");
    }
    btn.disabled = false;
}

async function actualizarClaveReal() {
    const vieja = document.getElementById('opt-old-pass').value.trim();
    const nueva = document.getElementById('opt-new-pass').value.trim();
    
    if(!vieja || !nueva) { alert("Por favor rellene ambos campos."); return; }

    const { data, error } = await _supabase.from('usuarios').select('*').eq('usuario', currentUsuario).eq('clave', vieja);

    if(error || !data || data.length === 0) {
        alert("La contraseña actual es incorrecta.");
        return;
    }

    const { error: updateError } = await _supabase.from('usuarios').update({ clave: nueva }).eq('usuario', currentUsuario);

    if(updateError) {
        alert("Error al intentar cambiar la contraseña.");
    } else {
        alert("Contraseña actualizada con éxito.");
        document.getElementById('opt-old-pass').value = "";
        document.getElementById('opt-new-pass').value = "";
        closeModal();
    }
}
