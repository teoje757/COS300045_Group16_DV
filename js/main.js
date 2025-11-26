// Main JavaScript file for COS30045 Group 16 Data Visualization

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', function() {
    console.log('COS30045 Group 16 Data Visualization - Loaded');
    
    // Initialize the application
    init();
    
    // Initialize landing page features if on index.html
    if (document.querySelector('.cta-button')) {
        initLandingPageFeatures();
    }
});

// Initialize function
function init() {
    console.log('Initializing data visualization...');
    
    // Add your initialization code here
    // This is where you'll set up your D3.js visualizations
    
    // Example: Get the visualization container
    const container = document.getElementById('visualization-container');
    
    if (container) {
        console.log('Visualization container found');
        // Future D3.js code will go here
    }
}

// Landing Page Interactive Features
function initLandingPageFeatures() {
    console.log('Initializing landing page features...');
    
    createParticles();
    initParallax();
    initButtonRipple();
}

// Create floating particles
function createParticles() {
    const particleCount = 30;
    const body = document.body;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        body.appendChild(particle);
    }
}

// Add mouse parallax effect
function initParallax() {
    document.addEventListener('mousemove', (e) => {
        const shapes = document.querySelectorAll('.floating-shape');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        shapes.forEach((shape, index) => {
            const speed = (index + 1) * 20;
            shape.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
    });
}

// Button ripple effect
function initButtonRipple() {
    const button = document.querySelector('.cta-button');
    
    if (button) {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    }
}

// Utility functions
function loadData(dataPath) {
    // Function to load data files
    // Will be implemented when adding D3.js
    console.log('Loading data from:', dataPath);
}

// Export functions if using modules (optional)
// export { init, loadData };