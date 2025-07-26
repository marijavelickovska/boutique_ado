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

// When the user clicks the submit button (complete order) the event listener prevents the form from submitting 
// and instead disables the card element and triggers the loading overlay.
// Then we create a few variables to capture the form data we can't put in the payment intent here, 
// and instead post it to the cache_checkout_data view. The view updates the payment intent and returns a 200 response, 
// at which point we call the confirm card payment method from stripe and if everything is ok submit the form. 
// If there's an error in the form then the loading overlay will be hidden, the card element re-enabled and 
// the error displayed for the user. If anything goes wrong posting the data to our view, 
// We'll reload the page and display the error without ever charging the user. 
// This may seem like a lot but I encourage you to review this and make sure you understand it. 
// Passing data back and forth between the front end and the back end is the essence of full-stack development. 
// So it's very important to understand it well, and don't worry if idoesn't make complete sense at first 
// because this is pretty involved and it'll take some time to get used to.

var form = document.getElementById('payment-form');

form.addEventListener('submit', function(ev) {
    ev.preventDefault();
    card.update({ 'disabled': true});
    $('#submit-button').attr('disabled', true);
    $('#payment-form').fadeToggle(100);  //triger the loading overlay
    $('#loading-overlay').fadeToggle(100);

    //update the payment intent ( few variables to save data from the form, odnosno tie sto ne mozeme da gi stavime in the payment intent here ) before calling the confirmed payment method
    var saveInfo = Boolean($('#id-save-info').attr('checked'));
    // From using {% csrf_token %} in the form
    var csrfToken = $('input[name="csrfmiddlewaretoken"]').val();
    var postData = {
        'csrfmiddlewaretoken': csrfToken,
        'client_secret': clientSecret,
        'save_info': saveInfo,
    };
    var url = '/checkout/cache_checkout_data/';

    $.post(url, postData).done(function () {  // na done, odnosno ako view vrati 200 response, ke se izvrsi slednata callback function
        stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: card,
                billing_details: {
                    name: $.trim(form.full_name.value),
                    phone: $.trim(form.phone_number.value),
                    email: $.trim(form.email.value),
                    address:{
                        line1: $.trim(form.street_address1.value),
                        line2: $.trim(form.street_address2.value),
                        city: $.trim(form.town_or_city.value),
                        country: $.trim(form.country.value),
                        state: $.trim(form.county.value),
                    }
                }
            },
            shipping: {
                name: $.trim(form.full_name.value),
                phone: $.trim(form.phone_number.value),
                address: {
                    line1: $.trim(form.street_address1.value),
                    line2: $.trim(form.street_address2.value),
                    city: $.trim(form.town_or_city.value),
                    country: $.trim(form.country.value),
                    postal_code: $.trim(form.postcode.value),
                    state: $.trim(form.county.value),
                }
            },
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
                    form.submit();  // koga sakas da testiras, mozes samo ovoj red da go zakomentiras za da vidis vo stripe i vo admin dali ke se kreira order
                }
            }
        });
    }).fail(function () {
        // just reload the page, the error will be in django messages
        location.reload();
    })
});


// Ova e objasnuvanje zasto samo ne pravime obicen payment so stripe, (taka bese najlesno) tuku koristime webhook i mu pravime update na payment intent
// za da gi sodrzi site podatoci kako billing i shipping details i bag 
// Stripe could potentially confirm the payment, but the user could close the page before the form is submitted on line 81
// To prevent this situation we're going to build in some redundancy.
// Each time an event occurs on stripe such as a payment intent being created, a payment being completed and so on stripe sends out what's called a webhook we can listen for.
// Webhooks are like the signals django sends each time a model is saved or deleted.
// Except that they're sent securely from stripe to a URL we specify.
// To handle these webhooks we're going to create our first custom class.
// I'll create a new file here called webhook_handler.py


// sega odkako se e sredeno i payment e izvrseno, stripe treba da ni prati webhook so payment intent (koj sto treba da dojde updejtiran,
// odnosno so nasata meta data attached). The payment intent will be saved in a key called event.data.object