class OrangeMoneyPayment {
  constructor() {
    this.form = document.getElementById('paymentForm');
    this.payButton = document.getElementById('payButton');
    this.resultMessage = document.getElementById('resultMessage');
    this.buttonText = this.payButton.querySelector('.button-text');
    this.buttonLoading = this.payButton.querySelector('.button-loading');
        
    this.init();
  }

  init() {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    this.setupInputValidation();
    this.generateOrderId();
  }

  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const orderId = `CMD-${timestamp}-${random}`;
    document.getElementById('order_id').value = orderId;
  }

  setupInputValidation() {
    const phoneInput = document.getElementById('phone');
        
    phoneInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 9) value = value.substring(0, 9);
      e.target.value = value;
    });

    const amountInput = document.getElementById('amount');
    amountInput.addEventListener('input', (e) => {
      if (e.target.value < 1000) {
        e.target.setCustomValidity('Le montant minimum est de 1000 GNF');
      } else {
        e.target.setCustomValidity('');
      }
    });
  }

  async handleSubmit(event) {
    event.preventDefault();
        
    const formData = new FormData(this.form);
    const paymentData = {
      order_id: formData.get('order_id'),
      amount: formData.get('amount'),
      phone: formData.get('phone'),
      description: formData.get('description')
    };

    // Validate form
    if (!this.validateForm(paymentData)) {
      return;
    }

    this.showLoading(true);
    this.hideResult();

    try {
      const response = await this.initiatePayment(paymentData);
            
      if (response.success) {
        this.showResult('success', 
          '✅ Paiement initié avec succès!<br>Redirection vers Orange Money...<br>' +
          '<small>Vous recevrez un code OTP par SMS</small>'
        );
                
        // Redirect to Orange Money after 3 seconds
        setTimeout(() => {
          window.location.href = response.payment_url;
        }, 3000);
                
      } else {
        this.showResult('error', `❌ ${response.message}`);
        this.showLoading(false);
      }
            
    } catch (error) {
      console.error('Payment error:', error);
      this.showResult('error', '❌ Erreur de connexion au serveur');
      this.showLoading(false);
    }
  }

  validateForm(data) {
    if (!data.amount || data.amount < 1000) {
      this.showResult('error', '❌ Le montant minimum est de 1000 GNF');
      return false;
    }

    if (!data.phone || !/^[0-9]{9}$/.test(data.phone)) {
      this.showResult('error', '❌ Numéro de téléphone invalide. Format: 9 chiffres');
      return false;
    }

    if (!data.order_id) {
      this.showResult('error', '❌ Numéro de commande requis');
      return false;
    }

    return true;
  }

  async initiatePayment(paymentData) {
    const response = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  showLoading(show) {
    if (show) {
      this.buttonText.style.display = 'none';
      this.buttonLoading.style.display = 'flex';
      this.payButton.disabled = true;
    } else {
      this.buttonText.style.display = 'block';
      this.buttonLoading.style.display = 'none';
      this.payButton.disabled = false;
    }
  }

  showResult(type, message) {
    this.resultMessage.style.display = 'block';
    this.resultMessage.className = `result-message ${type}`;
    this.resultMessage.innerHTML = message;
        
    // Scroll to result message
    this.resultMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  hideResult() {
    this.resultMessage.style.display = 'none';
  }
}

// Success and Cancel Pages
function handlePaymentResult() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id');
    
  if (orderId) {
    console.log('Payment result for order:', orderId);
    // You can update UI based on the page (success/cancel)
  }
}

// Initialize the payment system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OrangeMoneyPayment();
  handlePaymentResult();
});
