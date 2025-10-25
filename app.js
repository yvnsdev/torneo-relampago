import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuración de Supabase
const SUPABASE_URL = 'https://xgofamtgvqrmzmsqfdnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhnb2ZhbXRndnFybXptc3FmZG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDg4OTksImV4cCI6MjA3NTkyNDg5OX0.qnuP9O_c3kQIpo3_IKclnZqMeFx_upx5vBYN-wfAdnU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Aplicación principal del Torneo Relampago
class TorneoRelampagoApp {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.currentRegistration = null;
        this.disciplines = [];
        this.documents = [];
        this.registrations = [];
        this.currentEvent = null;
        
        this.init();
    }
    
    async init() {
        // Inicializar la aplicación
        this.setupEventListeners();
        this.setupRouting();
        await this.checkAuthState();
        await this.loadInitialData();
        this.renderNavigation();
        this.setupScrollAnimations();
    }
    
    // Configurar event listeners
    setupEventListeners() {
        // Navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.target.getAttribute('href').substring(1);
                this.navigateTo(target);
            });
        });
        
        // Botones de autenticación
        document.getElementById('login-btn').addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('register-btn').addEventListener('click', () => this.showAuthModal('register'));
        document.getElementById('logout-btn').addEventListener('click', () => this.signOut());
        
        // Modal de autenticación
        document.getElementById('auth-modal').addEventListener('click', (e) => {
            if (e.target.id === 'auth-modal') this.hideAuthModal();
        });
        document.querySelector('.modal-close').addEventListener('click', () => this.hideAuthModal());
        document.getElementById('auth-switch-btn').addEventListener('click', () => this.toggleAuthMode());
        document.getElementById('auth-form').addEventListener('submit', (e) => this.handleAuthSubmit(e));
        
        // Botón de inscripción del hero
        document.getElementById('hero-inscribe-btn').addEventListener('click', () => {
            if (this.currentUser) {
                this.navigateTo('inscripcion');
            } else {
                this.showAuthModal('register');
            }
        });
        
        // FAQ
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', (e) => this.toggleFaqAnswer(e));
        });
        
        // Menú móvil
        document.querySelector('.menu-toggle').addEventListener('click', () => this.toggleMobileMenu());
        
        // Panel de organizador
        const exportBtn = document.getElementById('export-csv');
        const filterDiscipline = document.getElementById('filter-discipline');
        const filterStatus = document.getElementById('filter-status');
        const searchRegistrations = document.getElementById('search-registrations');
        
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportRegistrationsCSV());
        if (filterDiscipline) filterDiscipline.addEventListener('change', () => this.filterRegistrations());
        if (filterStatus) filterStatus.addEventListener('change', () => this.filterRegistrations());
        if (searchRegistrations) searchRegistrations.addEventListener('input', () => this.filterRegistrations());
    }
    
    // Configurar animaciones de scroll
    setupScrollAnimations() {
        // Observador de intersección para animaciones
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);
        
        // Observar elementos para animación
        document.querySelectorAll('.step, .discipline-card, .feature, .testimonial-card').forEach(el => {
            observer.observe(el);
        });
    }
    
    // Configurar enrutamiento por hash
    setupRouting() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.substring(1) || 'inicio';
            this.showSection(hash);
        });
        
        // Navegar a la sección inicial
        const initialHash = window.location.hash.substring(1) || 'inicio';
        this.navigateTo(initialHash);
    }
    
    // Navegar a una sección
    navigateTo(section) {
        window.location.hash = section;
        this.showSection(section);
    }
    
    // Mostrar sección específica
    showSection(sectionId) {
        // Actualizar navegación activa
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Ocultar todas las secciones
        document.querySelectorAll('section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Mostrar la sección objetivo
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            
            // Cargar datos específicos si es necesario
            if (sectionId === 'disciplinas') {
                this.renderDisciplines();
            } else if (sectionId === 'reglamento') {
                this.renderDocuments();
            } else if (sectionId === 'inscripcion') {
                this.renderInscriptionForm();
            } else if (sectionId === 'mi-inscripcion') {
                this.renderMyRegistration();
            } else if (sectionId === 'panel-organizador') {
                if (this.userProfile && this.userProfile.role === 'organizer') {
                    this.renderAdminPanel();
                } else {
                    this.navigateTo('inicio');
                    this.showToast('No tienes permisos para acceder al panel de organizador', 'error');
                }
            }
        }
        
        // Cerrar menú móvil si está abierto
        this.closeMobileMenu();
        
        // Scroll suave al inicio de la sección (usa la altura del header calculada dinámicamente)
        if (targetSection) {
            const header = document.querySelector('.header');
            const headerOffset = header ? header.offsetHeight : 80;
            // dejar un pequeño margen visual
            const extraMargin = 8;
            window.scrollTo({
                top: targetSection.offsetTop - headerOffset - extraMargin,
                behavior: 'smooth'
            });
        }
    }
    
    // Verificar estado de autenticación
    async checkAuthState() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile();
                await this.loadUserRegistration();
            } else {
                this.currentUser = null;
                this.userProfile = null;
                this.currentRegistration = null;
            }
            
            this.renderNavigation();
        } catch (error) {
            console.error('Error verificando estado de autenticación:', error);
        }
    }
    
    // Cargar perfil de usuario
    async loadUserProfile() {
        if (!this.currentUser) return;
        
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') {
                    // No existe el perfil, crear uno
                    console.log('Creando perfil para usuario...');
                    await this.createUserProfile();
                    // Recargar después de crear
                    await this.loadUserProfile();
                    return;
                }
                throw error;
            }
            
            this.userProfile = data;
        } catch (error) {
            console.error('Error cargando perfil de usuario:', error);
        }
    }
    
    // Crear perfil de usuario
    async createUserProfile() {
        try {
            const { error } = await supabase
                .from('profiles')
                .insert({
                    id: this.currentUser.id,
                    full_name: this.currentUser.user_metadata?.full_name || 'Usuario',
                    role: 'participant',
                    created_at: new Date().toISOString()
                });
                
            if (error) throw error;
            console.log('Perfil creado exitosamente');
        } catch (error) {
            console.error('Error creando perfil:', error);
        }
    }
    
    // Cargar inscripción del usuario
    async loadUserRegistration() {
        if (!this.currentUser) return;
        
        try {
            const { data, error } = await supabase
                .from('registrations')
                .select(`
                    *,
                    disciplines (name, description)
                `)
                .eq('user_id', this.currentUser.id)
                .single();
                
            if (error && error.code !== 'PGRST116') throw error;
                
            this.currentRegistration = data || null;
        } catch (error) {
            console.error('Error cargando inscripción de usuario:', error);
        }
    }
    
    // Cargar datos iniciales
    async loadInitialData() {
        await this.loadDisciplines();
        await this.loadDocuments();
        await this.loadCurrentEvent();
        
        // Si es organizador, cargar inscripciones
        if (this.userProfile && this.userProfile.role === 'organizer') {
            await this.loadAllRegistrations();
        }
    }
    
    // Cargar disciplinas
    async loadDisciplines() {
        try {
            const { data, error } = await supabase
                .from('disciplines')
                .select('*')
                .eq('active', true)
                .order('name');
                
            if (error) throw error;
            
            this.disciplines = data || [];
            
            // Si no hay disciplinas en la base de datos, crear algunas de ejemplo
            if (this.disciplines.length === 0) {
                this.disciplines = [
                    {
                        id: 1,
                        name: "Atletismo Adaptado",
                        description: "Carreras y pruebas de campo adaptadas para todas las capacidades. Incluye categorías para sillas de ruedas, prótesis y guías para personas con discapacidad visual.",
                        quota: 50,
                        schedule: "Sábado 9:00 - 12:00",
                        active: true
                    },
                    {
                        id: 2,
                        name: "Natación Inclusiva",
                        description: "Competencias en piscina con categorías adaptadas. Disfruta del agua en un ambiente seguro y accesible con apoyo de profesionales.",
                        quota: 30,
                        schedule: "Viernes 14:00 - 17:00",
                        active: true
                    },
                    {
                        id: 3,
                        name: "Básquetbol en Silla de Ruedas",
                        description: "Emoción y trabajo en equipo en una de las disciplinas paralímpicas más populares. Equipos mixtos y categorías por experiencia.",
                        quota: 40,
                        schedule: "Sábado 15:00 - 18:00",
                        active: true
                    },
                    {
                        id: 4,
                        name: "Goalball",
                        description: "Deporte específicamente diseñado para personas con discapacidad visual. Pelota con cascabeles y campos delimitados con texturas.",
                        quota: 24,
                        schedule: "Domingo 10:00 - 13:00",
                        active: true
                    },
                    {
                        id: 5,
                        name: "Tenis de Mesa Adaptado",
                        description: "Para jugadores de pie o sentados. Mesas adaptadas y categorías según nivel de experiencia y tipo de discapacidad.",
                        quota: 32,
                        schedule: "Viernes 10:00 - 13:00",
                        active: true
                    },
                    {
                        id: 6,
                        name: "Boccia Paralímpica",
                        description: "Estrategia y precisión en este deporte similar a la petanca. Ideal para personas con discapacidad motriz severa.",
                        quota: 20,
                        schedule: "Domingo 14:00 - 16:00",
                        active: true
                    }
                ];
            }
        } catch (error) {
            console.error('Error cargando disciplinas:', error);
            this.showToast('Error cargando las disciplinas', 'error');
            this.disciplines = [];
        }
    }
    
    // Cargar documentos
    async loadDocuments() {
        try {
            const { data, error } = await supabase.storage
                .from('public-docs')
                .list('', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' }
                });
                
            if (error) {
                console.log('Bucket public-docs no disponible, usando documentos de ejemplo');
                // Documentos de ejemplo
                this.documents = [
                    { name: 'bases_torneo_2025.pdf' },
                    { name: 'reglamento_general.pdf' },
                    { name: 'protocolo_salud.pdf' },
                    { name: 'guia_accesibilidad.pdf' }
                ];
                return;
            }
            
            this.documents = data || [];
        } catch (error) {
            console.error('Error cargando documentos:', error);
            this.documents = [];
        }
    }
    
    // Cargar evento actual
    async loadCurrentEvent() {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('is_active', true)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('No hay evento activo, usando evento por defecto');
                    this.currentEvent = {
                        id: 1,
                        title: 'Torneo Relampago 2025',
                        start_date: '2025-05-15',
                        location: 'Estadio Municipal',
                        is_active: true
                    };
                    return;
                }
                throw error;
            }
            
            this.currentEvent = data;
        } catch (error) {
            console.error('Error cargando evento actual:', error);
            // Evento por defecto
            this.currentEvent = {
                id: 1,
                title: 'Torneo Relampago 2025',
                start_date: '2025-05-15',
                location: 'Estadio Municipal',
                is_active: true
            };
        }
    }
    
    // Cargar todas las inscripciones (solo organizadores)
    async loadAllRegistrations() {
        try {
            const { data, error } = await supabase
                .from('registrations')
                .select(`
                    *,
                    profiles (full_name, phone, commune),
                    disciplines (name)
                `)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            this.registrations = data || [];
        } catch (error) {
            console.error('Error cargando inscripciones:', error);
            this.showToast('Error cargando las inscripciones', 'error');
            this.registrations = [];
        }
    }
    
    // Renderizar navegación según estado de autenticación
    renderNavigation() {
        const authButtons = document.querySelector('.auth-buttons');
        const userMenu = document.getElementById('user-menu');
        
        if (this.currentUser) {
            authButtons.classList.add('hidden');
            userMenu.classList.remove('hidden');
            
            // Actualizar nombre en botón de usuario
            const userBtn = document.getElementById('user-btn');
            if (this.userProfile) {
                userBtn.textContent = this.userProfile.full_name || 'Mi Cuenta';
            }
            
            // Mostrar/ocultar panel de organizador en nav
            const orgPanelItem = document.querySelector('a[href="#panel-organizador"]');
            if (orgPanelItem) {
                const li = orgPanelItem.parentElement;
                if (this.userProfile && this.userProfile.role === 'organizer') {
                    li.classList.remove('hidden');
                } else {
                    li.classList.add('hidden');
                }
            }
        } else {
            authButtons.classList.remove('hidden');
            userMenu.classList.add('hidden');
            
            // Ocultar panel de organizador en nav
            const orgPanelItem = document.querySelector('a[href="#panel-organizador"]');
            if (orgPanelItem) {
                orgPanelItem.parentElement.classList.add('hidden');
            }
        }
    }
    
    // Mostrar modal de autenticación
    showAuthModal(mode = 'login') {
        const modal = document.getElementById('auth-modal');
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-submit');
        const switchText = document.getElementById('auth-switch-text');
        const registerFields = document.getElementById('auth-register-fields');
        
        // Resetear formulario
        document.getElementById('auth-form').reset();
        
        if (mode === 'register') {
            title.textContent = 'Crear Cuenta';
            submitBtn.textContent = 'Registrarse';
            switchText.innerHTML = '¿Ya tienes cuenta? <button id="auth-switch-btn" class="link-btn">Inicia sesión aquí</button>';
            registerFields.classList.remove('hidden');
        } else {
            title.textContent = 'Iniciar Sesión';
            submitBtn.textContent = 'Iniciar Sesión';
            switchText.innerHTML = '¿No tienes cuenta? <button id="auth-switch-btn" class="link-btn">Regístrate aquí</button>';
            registerFields.classList.add('hidden');
        }
        
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        // Enfocar primer campo
        document.getElementById('auth-email').focus();
    }
    
    // Ocultar modal de autenticación
    hideAuthModal() {
        const modal = document.getElementById('auth-modal');
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
    
    // Cambiar modo de autenticación (login/register)
    toggleAuthMode() {
        const title = document.getElementById('auth-modal-title');
        const currentMode = title.textContent === 'Iniciar Sesión' ? 'login' : 'register';
        this.showAuthModal(currentMode === 'login' ? 'register' : 'login');
    }
    
    // Manejar envío de formulario de autenticación
    async handleAuthSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const title = document.getElementById('auth-modal-title');
        const isRegister = title.textContent === 'Crear Cuenta';
        
        // Validaciones básicas
        if (!email || !password) {
            this.showToast('Por favor completa todos los campos', 'error');
            return;
        }
        
        if (isRegister) {
            const fullName = document.getElementById('auth-fullname').value;
            const phone = document.getElementById('auth-phone').value;
            const commune = document.getElementById('auth-commune').value;
            
            if (!fullName) {
                this.showToast('El nombre completo es obligatorio', 'error');
                return;
            }
            
            try {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });
                
                if (error) throw error;
                
                // Crear perfil de usuario
                if (data.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert({
                            id: data.user.id,
                            full_name: fullName,
                            phone: phone,
                            commune: commune,
                            created_at: new Date().toISOString()
                        });
                    
                    if (profileError) {
                        console.error('Error creando perfil:', profileError);
                        // No lanzamos error para no interrumpir el registro
                    }
                    
                    this.showToast('Cuenta creada exitosamente. Revisa tu email para verificar tu cuenta.', 'success');
                    this.hideAuthModal();
                }
            } catch (error) {
                console.error('Error en registro:', error);
                this.showToast(error.message, 'error');
            }
        } else {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (error) throw error;
                
                this.currentUser = data.user;
                await this.loadUserProfile();
                await this.loadUserRegistration();
                this.renderNavigation();
                
                this.showToast('Sesión iniciada exitosamente', 'success');
                this.hideAuthModal();
                
                // Si venía de intentar inscribirse, redirigir al formulario
                if (window.location.hash === '#inscripcion') {
                    this.renderInscriptionForm();
                }
            } catch (error) {
                console.error('Error en inicio de sesión:', error);
                this.showToast(error.message, 'error');
            }
        }
    }
    
    // Cerrar sesión
    async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            this.currentUser = null;
            this.userProfile = null;
            this.currentRegistration = null;
            this.renderNavigation();
            
            this.showToast('Sesión cerrada exitosamente', 'success');
            this.navigateTo('inicio');
        } catch (error) {
            console.error('Error cerrando sesión:', error);
            this.showToast('Error cerrando sesión', 'error');
        }
    }
    
    // Renderizar disciplinas
    renderDisciplines() {
        const container = document.getElementById('disciplines-container');
        
        if (!this.disciplines.length) {
            container.innerHTML = '<p class="text-center">No hay disciplinas disponibles en este momento.</p>';
            return;
        }
        
        // Mapeo de disciplinas a emojis
        const disciplineEmojis = {
            'Atletismo': '🏃',
            'Natación': '🏊',
            'Básquetbol': '🏀',
            'Goalball': '🔔',
            'Tenis de Mesa': '🏓',
            'Boccia': '🎯',
            'Atletismo Adaptado': '🏃‍♂️',
            'Natación Inclusiva': '🏊‍♀️',
            'Básquetbol en Silla de Ruedas': '🏀',
            'Goalball Paralímpico': '🔔',
            'Tenis de Mesa Adaptado': '🏓',
            'Boccia Paralímpica': '🎯'
        };
        
        container.innerHTML = this.disciplines.map(discipline => {
            const emoji = disciplineEmojis[discipline.name] || '⚽';
            return `
                <div class="discipline-card">
                    <div class="discipline-icon">${emoji}</div>
                    <h3 class="discipline-name">${discipline.name}</h3>
                    <p class="discipline-description">${discipline.description}</p>
                    <div class="discipline-meta">
                        <span class="discipline-quota ${discipline.quota > 0 ? 'available' : 'full'}">
                            Cupos: ${discipline.quota}
                        </span>
                        <span class="discipline-schedule">${discipline.schedule || 'Horario por definir'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Renderizar documentos
    renderDocuments() {
        const container = document.getElementById('documents-container');
        
        if (!this.documents.length) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No hay documentos disponibles en este momento.</p>
                    <p><small>Los documentos del reglamento aparecerán aquí cuando estén disponibles.</small></p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.documents.map(doc => `
            <a href="${supabase.storage.from('public-docs').getPublicUrl(doc.name).data.publicUrl}" 
               class="document-card" target="_blank" rel="noopener">
                <div class="document-icon">📄</div>
                <h3>${this.formatDocumentName(doc.name)}</h3>
                <p>Haz clic para descargar</p>
            </a>
        `).join('');
    }
    
    // Formatear nombre de documento para mostrar
    formatDocumentName(filename) {
        return filename
            .replace(/\.[^/.]+$/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Renderizar formulario de inscripción
    renderInscriptionForm() {
        const container = document.getElementById('inscription-container');
        
        if (!this.currentUser) {
            container.innerHTML = `
                <div class="text-center">
                    <p>Debes iniciar sesión para inscribirte en el torneo.</p>
                    <button class="btn-primary" id="inscription-login-btn">Iniciar Sesión</button>
                </div>
            `;
            
            document.getElementById('inscription-login-btn').addEventListener('click', () => {
                this.showAuthModal('login');
            });
            return;
        }
        
        if (this.currentRegistration) {
            const disciplineName = this.currentRegistration.disciplines?.name || 'Disciplina no disponible';
            container.innerHTML = `
                <div class="text-center">
                    <div class="registration-status">
                        <h3>¡Ya estás inscrito!</h3>
                        <p>Tu participación en el Torneo Relámpago 2025 está confirmada.</p>
                        <div class="registration-details-preview">
                            <p><strong>Disciplina:</strong> ${disciplineName}</p>
                            <p><strong>Estado:</strong> <span class="status-badge status-${this.currentRegistration.status}">${this.getStatusText(this.currentRegistration.status)}</span></p>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button class="btn-secondary" id="view-registration-btn">Ver Mi Inscripción</button>
                        <button class="btn-primary" id="edit-registration-btn">Editar Inscripción</button>
                    </div>
                </div>
            `;
            
            document.getElementById('view-registration-btn').addEventListener('click', () => {
                this.navigateTo('mi-inscripcion');
            });
            
            document.getElementById('edit-registration-btn').addEventListener('click', () => {
                this.renderInscriptionForm(true);
            });
            
            return;
        }
        
        this.renderInscriptionFormEditable();
    }
    
    // Renderizar formulario de inscripción editable
    renderInscriptionFormEditable(isEditing = false) {
        const container = document.getElementById('inscription-container');
        const registration = isEditing ? this.currentRegistration : null;
        
        container.innerHTML = `
            <div class="inscription-header">
                <h3>${isEditing ? 'Actualiza tu inscripción' : 'Completa tu inscripción'}</h3>
                <p>${isEditing ? 'Modifica los datos que necesites cambiar.' : 'Todos los campos marcados con * son obligatorios.'}</p>
            </div>
            <form id="registration-form" class="inscription-form">
                <div class="form-section">
                    <h3>Datos Personales</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="reg-rut">RUT *</label>
                            <input type="text" id="reg-rut" required 
                                   value="${registration ? registration.rut : ''}"
                                   aria-required="true" placeholder="12.345.678-9">
                        </div>
                        <div class="form-group">
                            <label for="reg-birthdate">Fecha de Nacimiento *</label>
                            <input type="date" id="reg-birthdate" required
                                   value="${registration ? registration.birth_date : ''}"
                                   aria-required="true">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="reg-phone">Teléfono *</label>
                        <input type="tel" id="reg-phone" required
                               value="${registration ? registration.phone : (this.userProfile ? this.userProfile.phone : '')}"
                               aria-required="true" placeholder="+56 9 1234 5678">
                    </div>
                    <div class="form-group">
                        <label for="reg-commune">Comuna *</label>
                        <input type="text" id="reg-commune" required
                               value="${registration ? registration.commune : (this.userProfile ? this.userProfile.commune : '')}"
                               aria-required="true" placeholder="Tu comuna">
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>Datos Deportivos</h3>
                    <div class="form-group">
                        <label for="reg-discipline">Disciplina *</label>
                        <select id="reg-discipline" required aria-required="true">
                            <option value="">Selecciona una disciplina</option>
                            ${this.disciplines.map(d => `
                                <option value="${d.id}" 
                                        ${registration && registration.discipline_id === d.id ? 'selected' : ''}
                                        ${d.quota <= 0 ? 'disabled' : ''}>
                                    ${d.name} ${d.quota <= 0 ? '(Cupo lleno)' : ''}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reg-skill">Nivel de Habilidad *</label>
                        <select id="reg-skill" required aria-required="true">
                            <option value="">Selecciona tu nivel</option>
                            <option value="beginner" ${registration && registration.skill_level === 'beginner' ? 'selected' : ''}>Principiante (Primera vez)</option>
                            <option value="intermediate" ${registration && registration.skill_level === 'intermediate' ? 'selected' : ''}>Intermedio (Alguna experiencia)</option>
                            <option value="advanced" ${registration && registration.skill_level === 'advanced' ? 'selected' : ''}>Avanzado (Competencia regular)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reg-shirt">Talla de Polera</label>
                        <select id="reg-shirt">
                            <option value="">Selecciona talla</option>
                            <option value="XS" ${registration && registration.shirt_size === 'XS' ? 'selected' : ''}>XS</option>
                            <option value="S" ${registration && registration.shirt_size === 'S' ? 'selected' : ''}>S</option>
                            <option value="M" ${registration && registration.shirt_size === 'M' ? 'selected' : ''}>M</option>
                            <option value="L" ${registration && registration.shirt_size === 'L' ? 'selected' : ''}>L</option>
                            <option value="XL" ${registration && registration.shirt_size === 'XL' ? 'selected' : ''}>XL</option>
                            <option value="XXL" ${registration && registration.shirt_size === 'XXL' ? 'selected' : ''}>XXL</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reg-access">Consideraciones de Accesibilidad</label>
                        <textarea id="reg-access" rows="3" placeholder="Describe cualquier necesidad de accesibilidad o consideración especial que debamos conocer (ej: requiere intérprete de señas, asistencia para movilidad, materiales en formato accesible, etc.)">${registration ? registration.access_notes : ''}</textarea>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>Documentos (Opcional)</h3>
                    <p class="form-help">Puedes adjuntar un certificado médico o comprobante si lo deseas. No es obligatorio para participar.</p>
                    <div class="file-upload" id="file-upload-area">
                        <input type="file" id="reg-file" class="file-input" accept=".pdf,.jpg,.jpeg,.png">
                        <p>Haz clic o arrastra aquí para subir un archivo</p>
                        <p class="text-small">Formatos aceptados: PDF, JPG, PNG (máx. 5MB)</p>
                    </div>
                    <div id="file-preview" class="${registration && registration.storage_file_path ? '' : 'hidden'}">
                        <p>Archivo actual: <span id="current-file-name">${registration ? this.getFileNameFromPath(registration.storage_file_path) : ''}</span></p>
                        <button type="button" class="btn-secondary" id="remove-file-btn">Eliminar archivo</button>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="reg-terms" required aria-required="true">
                            <span>Acepto las bases del torneo y autorizo el tratamiento de mis datos según la <a href="#" class="link-btn">política de privacidad</a>.</span>
                        </label>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancel-registration-btn">Cancelar</button>
                    <button type="submit" class="btn-primary">${isEditing ? 'Actualizar Inscripción' : 'Enviar Inscripción'}</button>
                </div>
            </form>
        `;
        
        // Configurar event listeners del formulario
        this.setupRegistrationFormListeners(isEditing);
    }
    
    // Configurar event listeners del formulario de inscripción
    setupRegistrationFormListeners(isEditing = false) {
        const form = document.getElementById('registration-form');
        const fileUpload = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('reg-file');
        const filePreview = document.getElementById('file-preview');
        const removeFileBtn = document.getElementById('remove-file-btn');
        const cancelBtn = document.getElementById('cancel-registration-btn');
        
        // Subida de archivos
        if (fileUpload && fileInput) {
            fileUpload.addEventListener('click', () => fileInput.click());
            fileUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUpload.style.borderColor = 'var(--color-primary)';
            });
            fileUpload.addEventListener('dragleave', () => {
                fileUpload.style.borderColor = 'var(--color-border)';
            });
            fileUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUpload.style.borderColor = 'var(--color-border)';
                
                if (e.dataTransfer.files.length) {
                    fileInput.files = e.dataTransfer.files;
                    this.handleFileSelection(fileInput.files[0]);
                }
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    this.handleFileSelection(e.target.files[0]);
                }
            });
        }
        
        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', () => {
                if (fileInput) fileInput.value = '';
                if (filePreview) filePreview.classList.add('hidden');
            });
        }
        
        // Cancelar
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (isEditing) {
                    this.renderInscriptionForm();
                } else {
                    this.navigateTo('disciplinas');
                }
            });
        }
        
        // Envío del formulario
        if (form) {
            form.addEventListener('submit', (e) => this.handleRegistrationSubmit(e, isEditing));
        }
    }
    
    // Manejar selección de archivo
    handleFileSelection(file) {
        // Validar tipo y tamaño
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!validTypes.includes(file.type)) {
            this.showToast('Tipo de archivo no válido. Use PDF, JPG o PNG.', 'error');
            return;
        }
        
        if (file.size > maxSize) {
            this.showToast('El archivo es demasiado grande. Máximo 5MB.', 'error');
            return;
        }
        
        // Mostrar preview
        const currentFileName = document.getElementById('current-file-name');
        const filePreview = document.getElementById('file-preview');
        
        if (currentFileName) currentFileName.textContent = file.name;
        if (filePreview) filePreview.classList.remove('hidden');
    }
    
    // Manejar envío de formulario de inscripción
    async handleRegistrationSubmit(e, isEditing = false) {
        e.preventDefault();
        
        // Validaciones
        const rut = document.getElementById('reg-rut').value;
        const birthdate = document.getElementById('reg-birthdate').value;
        const phone = document.getElementById('reg-phone').value;
        const commune = document.getElementById('reg-commune').value;
        const discipline = document.getElementById('reg-discipline').value;
        const skill = document.getElementById('reg-skill').value;
        const terms = document.getElementById('reg-terms').checked;
        const fileInput = document.getElementById('reg-file');
        
        if (!rut || !birthdate || !phone || !commune || !discipline || !skill || !terms) {
            this.showToast('Por favor completa todos los campos obligatorios', 'error');
            return;
        }
        
        // Validación básica de RUT (formato chileno)
        if (!this.validateRUT(rut)) {
            this.showToast('El RUT ingresado no es válido', 'error');
            return;
        }
        
        try {
            let filePath = null;
            
            // Subir archivo si hay uno seleccionado
            if (fileInput && fileInput.files.length) {
                const file = fileInput.files[0];
                const fileName = `${Date.now()}_${file.name}`;
                filePath = `user-files/${this.currentUser.id}/${fileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('user-files')
                    .upload(filePath, file);
                    
                if (uploadError) {
                    console.error('Error subiendo archivo:', uploadError);
                    // Continuamos sin el archivo
                }
            }
            
            // Preparar datos de inscripción
            const registrationData = {
                user_id: this.currentUser.id,
                event_id: this.currentEvent.id,
                discipline_id: parseInt(discipline),
                rut: rut,
                birth_date: birthdate,
                phone: phone,
                commune: commune,
                skill_level: skill,
                shirt_size: document.getElementById('reg-shirt').value || null,
                access_notes: document.getElementById('reg-access').value || null,
                storage_file_path: filePath
            };
            
            let result;
            
            if (isEditing) {
                // Actualizar inscripción existente
                result = await supabase
                    .from('registrations')
                    .update(registrationData)
                    .eq('id', this.currentRegistration.id);
            } else {
                // Crear nueva inscripción
                result = await supabase
                    .from('registrations')
                    .insert(registrationData);
            }
            
            if (result.error) throw result.error;
            
            // Actualizar perfil de usuario con teléfono y comuna
            await supabase
                .from('profiles')
                .update({
                    phone: phone,
                    commune: commune
                })
                .eq('id', this.currentUser.id);
            
            // Recargar datos
            await this.loadUserProfile();
            await this.loadUserRegistration();
            
            this.showToast(
                isEditing ? 'Inscripción actualizada exitosamente' : '¡Inscripción enviada! Te has registrado en el Torneo Relámpago 2025', 
                'success'
            );
            
            this.renderInscriptionForm();
            
        } catch (error) {
            console.error('Error procesando inscripción:', error);
            this.showToast(error.message, 'error');
        }
    }
    
    // Validación básica de RUT chileno
    validateRUT(rut) {
        // Eliminar puntos y guión, convertir a mayúsculas
        rut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
        
        // Separar número y dígito verificador
        const rutNumber = rut.slice(0, -1);
        const dv = rut.slice(-1);
        
        // Validar que el número sea válido
        if (!/^\d+$/.test(rutNumber) || (rutNumber.length < 7 || rutNumber.length > 8)) {
            return false;
        }
        
        // Validar que el dígito verificador sea válido
        if (!/^[0-9K]$/.test(dv)) {
            return false;
        }
        
        // Cálculo del dígito verificador esperado
        let sum = 0;
        let multiplier = 2;
        
        for (let i = rutNumber.length - 1; i >= 0; i--) {
            sum += parseInt(rutNumber.charAt(i)) * multiplier;
            multiplier = multiplier === 7 ? 2 : multiplier + 1;
        }
        
        const expectedDV = 11 - (sum % 11);
        let calculatedDV;
        
        if (expectedDV === 11) calculatedDV = '0';
        else if (expectedDV === 10) calculatedDV = 'K';
        else calculatedDV = expectedDV.toString();
        
        return calculatedDV === dv;
    }
    
    // Obtener nombre de archivo desde la ruta
    getFileNameFromPath(path) {
        return path ? path.split('/').pop() : '';
    }
    
    // Renderizar mi inscripción
    renderMyRegistration() {
        const container = document.getElementById('my-registration-container');
        
        if (!this.currentRegistration) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No tienes una inscripción activa.</p>
                    <button class="btn-primary" id="create-registration-btn">Inscribirme</button>
                </div>
            `;
            
            document.getElementById('create-registration-btn').addEventListener('click', () => {
                this.navigateTo('inscripcion');
            });
            return;
        }
        
        const disciplineName = this.currentRegistration.disciplines?.name || 'Disciplina no disponible';
        
        container.innerHTML = `
            <div class="registration-details">
                <div class="registration-header">
                    <h3>Detalles de tu inscripción</h3>
                    <p>Revisa la información de tu participación en el Torneo Relámpago 2025</p>
                </div>
                
                <div class="detail-section">
                    <h3>Información Personal</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Nombre:</strong> ${this.userProfile?.full_name || 'No disponible'}
                        </div>
                        <div class="detail-item">
                            <strong>RUT:</strong> ${this.currentRegistration.rut}
                        </div>
                        <div class="detail-item">
                            <strong>Fecha de Nacimiento:</strong> ${new Date(this.currentRegistration.birth_date).toLocaleDateString('es-CL')}
                        </div>
                        <div class="detail-item">
                            <strong>Email:</strong> ${this.currentUser.email}
                        </div>
                        <div class="detail-item">
                            <strong>Teléfono:</strong> ${this.currentRegistration.phone}
                        </div>
                        <div class="detail-item">
                            <strong>Comuna:</strong> ${this.currentRegistration.commune}
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Información Deportiva</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Disciplina:</strong> ${disciplineName}
                        </div>
                        <div class="detail-item">
                            <strong>Nivel:</strong> ${this.getSkillLevelText(this.currentRegistration.skill_level)}
                        </div>
                        <div class="detail-item">
                            <strong>Talla de Polera:</strong> ${this.currentRegistration.shirt_size || 'No especificada'}
                        </div>
                        <div class="detail-item">
                            <strong>Consideraciones de Accesibilidad:</strong> ${this.currentRegistration.access_notes || 'Ninguna'}
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Estado de la Inscripción</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Estado:</strong> <span class="status-badge status-${this.currentRegistration.status}">${this.getStatusText(this.currentRegistration.status)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Fecha de Inscripción:</strong> ${new Date(this.currentRegistration.created_at).toLocaleDateString('es-CL')}
                        </div>
                        ${this.currentRegistration.storage_file_path ? `
                        <div class="detail-item">
                            <strong>Archivo Adjunto:</strong> ${this.getFileNameFromPath(this.currentRegistration.storage_file_path)}
                            <button class="btn-secondary btn-small" id="download-file-btn">Descargar</button>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="registration-actions">
                    <h4>Gestiona tu participación</h4>
                    <div class="form-actions">
                        <button class="btn-primary" id="edit-my-registration-btn">Editar Inscripción</button>
                        ${this.currentRegistration.storage_file_path ? `
                        <button class="btn-secondary" id="replace-file-btn">Reemplazar Archivo</button>
                        ` : `
                        <button class="btn-secondary" id="add-file-btn">Agregar Archivo</button>
                        `}
                    </div>
                </div>
                
                <div class="registration-next-steps">
                    <h4>Próximos pasos</h4>
                    <ul>
                        <li>Recibirás un email de confirmación en los próximos días</li>
                        <li>Revisa tu bandeja de entrada regularmente para actualizaciones</li>
                        <li>El programa detallado del evento se publicará 2 semanas antes</li>
                        <li>Si tienes preguntas, no dudes en contactarnos</li>
                    </ul>
                </div>
            </div>
        `;
        
        // Configurar event listeners
        document.getElementById('edit-my-registration-btn').addEventListener('click', () => {
            this.navigateTo('inscripcion');
        });
        
        const downloadBtn = document.getElementById('download-file-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadUserFile(this.currentRegistration.storage_file_path);
            });
        }
        
        const replaceBtn = document.getElementById('replace-file-btn');
        const addBtn = document.getElementById('add-file-btn');
        if (replaceBtn || addBtn) {
            const btn = replaceBtn || addBtn;
            btn.addEventListener('click', () => {
                this.showFileUploadModal();
            });
        }
    }
    
    // Mostrar modal para subir archivo
    showFileUploadModal() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.jpg,.jpeg,.png';
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length) {
                await this.uploadUserFile(e.target.files[0]);
            }
        });
        fileInput.click();
    }
    
    // Subir archivo de usuario
    async uploadUserFile(file) {
        try {
            const fileName = `${Date.now()}_${file.name}`;
            const filePath = `user-files/${this.currentUser.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('user-files')
                .upload(filePath, file);
                
            if (uploadError) throw uploadError;
            
            // Actualizar la inscripción con la nueva ruta del archivo
            const { error: updateError } = await supabase
                .from('registrations')
                .update({ storage_file_path: filePath })
                .eq('id', this.currentRegistration.id);
                
            if (updateError) throw updateError;
            
            // Recargar datos
            await this.loadUserRegistration();
            this.renderMyRegistration();
            
            this.showToast('Archivo subido exitosamente', 'success');
        } catch (error) {
            console.error('Error subiendo archivo:', error);
            this.showToast('Error subiendo el archivo', 'error');
        }
    }
    
    // Descargar archivo de usuario
    async downloadUserFile(filePath) {
        try {
            const { data, error } = await supabase.storage
                .from('user-files')
                .download(filePath);
                
            if (error) throw error;
            
            // Crear enlace de descarga
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.getFileNameFromPath(filePath);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error descargando archivo:', error);
            this.showToast('Error descargando el archivo', 'error');
        }
    }
    
    // Renderizar panel de administración
    renderAdminPanel() {
        const container = document.getElementById('registrations-table-container');
        
        if (!this.registrations.length) {
            container.innerHTML = '<p class="text-center">No hay inscripciones para mostrar.</p>';
            return;
        }
        
        // Llenar filtro de disciplinas
        const disciplineFilter = document.getElementById('filter-discipline');
        const uniqueDisciplines = [...new Set(this.registrations.map(r => r.disciplines?.name).filter(Boolean))];
        
        if (disciplineFilter) {
            disciplineFilter.innerHTML = '<option value="">Todas las disciplinas</option>' +
                uniqueDisciplines.map(d => `<option value="${d}">${d}</option>`).join('');
        }
        
        // Renderizar tabla
        container.innerHTML = `
            <div class="table-responsive">
                <table class="registrations-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Disciplina</th>
                            <th>RUT</th>
                            <th>Teléfono</th>
                            <th>Comuna</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.registrations.map(registration => `
                            <tr data-registration-id="${registration.id}">
                                <td>${registration.profiles?.full_name || 'No disponible'}</td>
                                <td>${registration.disciplines?.name || 'No disponible'}</td>
                                <td>${registration.rut}</td>
                                <td>${registration.phone}</td>
                                <td>${registration.commune}</td>
                                <td>
                                    <select class="status-select" data-registration-id="${registration.id}">
                                        <option value="pending" ${registration.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                                        <option value="approved" ${registration.status === 'approved' ? 'selected' : ''}>Aprobado</option>
                                        <option value="observed" ${registration.status === 'observed' ? 'selected' : ''}>Observado</option>
                                    </select>
                                </td>
                                <td>${new Date(registration.created_at).toLocaleDateString('es-CL')}</td>
                                <td>
                                    <button class="btn-secondary btn-small view-registration-btn" data-registration-id="${registration.id}">Ver</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Configurar event listeners
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateRegistrationStatus(
                    e.target.dataset.registrationId, 
                    e.target.value
                );
            });
        });
        
        document.querySelectorAll('.view-registration-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const registrationId = e.target.dataset.registrationId;
                this.viewRegistrationDetails(registrationId);
            });
        });
    }
    
    // Actualizar estado de inscripción
    async updateRegistrationStatus(registrationId, newStatus) {
        try {
            const { error } = await supabase
                .from('registrations')
                .update({ status: newStatus })
                .eq('id', registrationId);
                
            if (error) throw error;
            
            // Actualizar datos locales
            const registration = this.registrations.find(r => r.id == registrationId);
            if (registration) {
                registration.status = newStatus;
            }
            
            this.showToast('Estado actualizado exitosamente', 'success');
        } catch (error) {
            console.error('Error actualizando estado:', error);
            this.showToast('Error actualizando el estado', 'error');
        }
    }
    
    // Ver detalles de inscripción (modal simplificado)
    viewRegistrationDetails(registrationId) {
        const registration = this.registrations.find(r => r.id == registrationId);
        
        if (!registration) return;
        
        alert(`
            Detalles de Inscripción:
            
            Nombre: ${registration.profiles?.full_name || 'No disponible'}
            Email: ${registration.user_id} (ID de usuario)
            RUT: ${registration.rut}
            Fecha de Nacimiento: ${new Date(registration.birth_date).toLocaleDateString('es-CL')}
            Teléfono: ${registration.phone}
            Comuna: ${registration.commune}
            Disciplina: ${registration.disciplines?.name || 'No disponible'}
            Nivel: ${this.getSkillLevelText(registration.skill_level)}
            Talla de Polera: ${registration.shirt_size || 'No especificada'}
            Consideraciones de Accesibilidad: ${registration.access_notes || 'Ninguna'}
            Archivo Adjunto: ${registration.storage_file_path ? 'Sí' : 'No'}
            Estado: ${this.getStatusText(registration.status)}
            Fecha de Inscripción: ${new Date(registration.created_at).toLocaleDateString('es-CL')}
        `);
    }
    
    // Filtrar inscripciones en panel de administración
    filterRegistrations() {
        const disciplineFilter = document.getElementById('filter-discipline');
        const statusFilter = document.getElementById('filter-status');
        const searchTerm = document.getElementById('search-registrations');
        
        if (!disciplineFilter || !statusFilter || !searchTerm) return;
        
        const disciplineValue = disciplineFilter.value;
        const statusValue = statusFilter.value;
        const searchValue = searchTerm.value.toLowerCase();
        
        const rows = document.querySelectorAll('.registrations-table tbody tr');
        
        rows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            const discipline = row.cells[1].textContent;
            const statusSelect = row.querySelector('.status-select');
            const status = statusSelect ? statusSelect.value : '';
            
            const matchesDiscipline = !disciplineValue || discipline === disciplineValue;
            const matchesStatus = !statusValue || status === statusValue;
            const matchesSearch = !searchValue || name.includes(searchValue);
            
            row.style.display = matchesDiscipline && matchesStatus && matchesSearch ? '' : 'none';
        });
    }
    
    // Exportar inscripciones a CSV
    exportRegistrationsCSV() {
        if (!this.registrations.length) {
            this.showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        const headers = ['Nombre', 'Email', 'RUT', 'Teléfono', 'Comuna', 'Disciplina', 'Nivel', 'Estado', 'Fecha'];
        const csvData = this.registrations.map(reg => [
            reg.profiles?.full_name || 'No disponible',
            reg.user_id,
            reg.rut,
            reg.phone,
            reg.commune,
            reg.disciplines?.name || 'No disponible',
            this.getSkillLevelText(reg.skill_level),
            this.getStatusText(reg.status),
            new Date(reg.created_at).toLocaleDateString('es-CL')
        ]);
        
        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
            
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inscripciones-torneo-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('CSV exportado exitosamente', 'success');
    }
    
    // Utilidades para textos
    getStatusText(status) {
        const statusMap = {
            'pending': 'Pendiente',
            'approved': 'Aprobado',
            'observed': 'Observado'
        };
        return statusMap[status] || status;
    }
    
    getSkillLevelText(level) {
        const levelMap = {
            'beginner': 'Principiante',
            'intermediate': 'Intermedio',
            'advanced': 'Avanzado'
        };
        return levelMap[level] || level;
    }
    
    // Mostrar notificaciones toast
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');
        
        if (toastMessage) toastMessage.textContent = message;
        
        // Cambiar icono según el tipo
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        else if (type === 'warning') icon = '⚠️';
        
        if (toastIcon) toastIcon.textContent = icon;
        
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 5000);
    }
    
    // Alternar respuestas FAQ
    toggleFaqAnswer(e) {
        const question = e.currentTarget;
        const isExpanded = question.getAttribute('aria-expanded') === 'true';
        
        question.setAttribute('aria-expanded', !isExpanded);
    }
    
    // Menú móvil
    toggleMobileMenu() {
        const nav = document.querySelector('.nav');
        const toggle = document.querySelector('.menu-toggle');
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        // Calcular la posición superior para que el nav quede exactamente debajo del header
        const header = document.querySelector('.header');
        const headerHeight = header ? header.offsetHeight : 0;

        if (!isExpanded) {
            // Abrir: ajustar posición y altura para que no se superponga al header
            nav.style.top = `${headerHeight}px`;
            nav.style.height = `calc(100% - ${headerHeight}px)`;
        } else {
            // Cerrar: limpiar estilos inline
            nav.style.top = '';
            nav.style.height = '';
        }

        toggle.setAttribute('aria-expanded', (!isExpanded).toString());
        nav.classList.toggle('active');
    }
    
    closeMobileMenu() {
        const nav = document.querySelector('.nav');
        const toggle = document.querySelector('.menu-toggle');
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('active');
        // limpiar estilos inline aplicados al abrir
        nav.style.top = '';
        nav.style.height = '';
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.torneoApp = new TorneoRelampagoApp();
});