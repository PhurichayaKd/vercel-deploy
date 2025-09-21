// LIFF Date Picker JavaScript
class LiffDatePicker {
    constructor() {
        this.selectedDate = null;
        this.init();
    }

    async init() {
        try {
            // Initialize LIFF
            await liff.init({ liffId: 'YOUR_LIFF_ID' }); // จะต้องแทนที่ด้วย LIFF ID จริง
            
            if (!liff.isLoggedIn()) {
                liff.login();
                return;
            }

            this.setupEventListeners();
            this.setMinDate();
            
        } catch (error) {
            console.error('LIFF initialization failed:', error);
            this.showError('ไม่สามารถเชื่อมต่อกับ LINE ได้');
        }
    }

    setupEventListeners() {
        const dateInput = document.getElementById('leave-date');
        const confirmBtn = document.getElementById('confirm-btn');
        const cancelBtn = document.getElementById('cancel-btn');

        // Date input change event
        dateInput.addEventListener('change', (e) => {
            this.handleDateChange(e.target.value);
        });

        // Confirm button click
        confirmBtn.addEventListener('click', () => {
            this.confirmDate();
        });

        // Cancel button click
        cancelBtn.addEventListener('click', () => {
            this.cancelSelection();
        });
    }

    setMinDate() {
        const dateInput = document.getElementById('leave-date');
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const minDate = tomorrow.toISOString().split('T')[0];
        dateInput.min = minDate;
    }

    handleDateChange(dateValue) {
        if (!dateValue) {
            this.clearSelection();
            return;
        }

        const selectedDate = new Date(dateValue);
        const today = new Date();
        
        // Check if date is in the future
        if (selectedDate <= today) {
            this.showError('กรุณาเลือกวันที่ในอนาคต');
            this.clearSelection();
            return;
        }

        this.selectedDate = dateValue;
        this.displaySelectedDate(selectedDate);
        this.enableConfirmButton();
    }

    displaySelectedDate(date) {
        const selectedDateDiv = document.getElementById('selected-date');
        const selectedDateText = document.getElementById('selected-date-text');
        
        const thaiDate = this.formatThaiDate(date);
        selectedDateText.textContent = thaiDate;
        selectedDateDiv.style.display = 'block';
        selectedDateDiv.classList.add('success-animation');
    }

    formatThaiDate(date) {
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        
        const day = date.getDate();
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543; // Convert to Buddhist Era
        
        return `${day} ${month} ${year}`;
    }

    enableConfirmButton() {
        const confirmBtn = document.getElementById('confirm-btn');
        confirmBtn.disabled = false;
    }

    clearSelection() {
        const selectedDateDiv = document.getElementById('selected-date');
        const confirmBtn = document.getElementById('confirm-btn');
        const dateInput = document.getElementById('leave-date');
        
        selectedDateDiv.style.display = 'none';
        confirmBtn.disabled = true;
        dateInput.value = '';
        this.selectedDate = null;
    }

    async confirmDate() {
        if (!this.selectedDate) {
            this.showError('กรุณาเลือกวันที่');
            return;
        }

        try {
            const confirmBtn = document.getElementById('confirm-btn');
            const originalText = confirmBtn.innerHTML;
            
            // Show loading
            confirmBtn.innerHTML = '<span class="loading"></span>กำลังส่ง...';
            confirmBtn.disabled = true;

            // Format date for sending
            const selectedDate = new Date(this.selectedDate);
            const thaiDate = this.formatThaiDate(selectedDate);
            const message = `วันที่แจ้งลา: ${thaiDate}`;

            // Send message back to chat
            if (liff.isApiAvailable('sendMessages')) {
                await liff.sendMessages([
                    {
                        type: 'text',
                        text: message
                    }
                ]);
            }

            // Close LIFF window
            liff.closeWindow();
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่');
            
            // Reset button
            const confirmBtn = document.getElementById('confirm-btn');
            confirmBtn.innerHTML = '✅ ยืนยันวันที่';
            confirmBtn.disabled = false;
        }
    }

    cancelSelection() {
        try {
            liff.closeWindow();
        } catch (error) {
            console.error('Error closing LIFF:', error);
            window.close();
        }
    }

    showError(message) {
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: #ffebee;
            color: #c62828;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            border: 1px solid #ef5350;
            text-align: center;
            font-weight: 600;
        `;
        errorDiv.textContent = message;

        // Insert error message
        const container = document.querySelector('.date-picker-container');
        const existingError = container.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        container.insertBefore(errorDiv, container.firstChild);

        // Remove error message after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LiffDatePicker();
});

// Handle LIFF errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});