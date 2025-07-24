/*
    Core logic/payment flow for this comes from here:
    https://stripe.com/docs/payments/accept-a-payment

    CSS from here: 
    https://stripe.com/docs/stripe-js
*/

var stripePublicKey  = $('#id_stripe_public_key').text().slice(1, -1);  //slice off the first and last character on each since they'll have quotation marks which we don't want
var clientSecret  = $('#id_client_secret').text().slice(1, -1);
// made possible by the stripe js included in the base template.
// All we need to do to set up stripe is create a variable using our stripe public key.
// Now we can use it to create an instance of stripe elements.
// Use that to create a card element.
// And finally, mount the card element to the div we created in the last video
var stripe = Stripe(stripePublicKey);
var elements = stripe.elements();
var style = {
    base: {
        color: '#000',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: 'antialiased',
        fontSize: '16px',
        '::placeholder': {
            color: '#aab7c4'
        }
    },
    invalid: {
        color: '#dc3545',
        iconColor: '#dc3545'
    }
};
var card = elements.create('card', {style: style});
card.mount('#card-element');

// Handle realtime validation errors on the card element
card.addEventListener('change', function (event) {
    var errorDiv = document.getElementById('card-errors');
    if (event.error) {
        var html = `
            <span class="icon" role="alert">
                <i class="fas fa-times"></i>
            </span>
            <span>${event.error.message}</span>
        `;
        $(errorDiv).html(html);
    } else {
        errorDiv.textContent = '';
    }
});


// Handle form submit
var form = document.getElementById('payment-form');

form.addEventListener('submit', function(ev) {
    ev.preventDefault();
    card.update({ 'disabled': true});
    $('#submit-button').attr('disabled', true);
    $('#payment-form').fadeToggle(100);
    $('#loading-overlay').fadeToggle(100);
    stripe.confirmCardPayment(clientSecret, {
        payment_method: {
            card: card,
        }                                             
    }).then(function(result) {
        if (result.error) {
            var errorDiv = document.getElementById('card-errors');
            var html = `
                <span class="icon" role="alert">
                <i class="fas fa-times"></i>
                </span>
                <span>${result.error.message}</span>`;
            $(errorDiv).html(html);
            $('#payment-form').fadeToggle(100);
            $('#loading-overlay').fadeToggle(100);
            card.update({ 'disabled': false});
            $('#submit-button').attr('disabled', false);
        } else {
            if (result.paymentIntent.status === 'succeeded') {
                form.submit();
            }
        }
    });
});

// Stripe could potentially confirm the payment, but the user could close the page before the form is submitted on line 81
// To prevent this situation we're going to build in some redundancy.
// Each time an event occurs on stripe such as a payment intent being created, a payment being completed and so on stripe sends out what's called a webhook we can listen for.
// Webhooks are like the signals django sends each time a model is saved or deleted.
// Except that they're sent securely from stripe to a URL we specify.
// To handle these webhooks we're going to create our first custom class.
// I'll create a new file here called webhook_handler.py