from django.shortcuts import render, redirect

# Create your views here.

def view_bag(request):
    """ A view that renders the bag contents page """

    return render(request, 'bag/bag.html')


def add_to_bag(request, item_id):
    """ Add a quantity of the specified product to the shopping bag """

    quantity = int(request.POST.get('quantity'))
    redirect_url = request.POST.get('redirect_url')
    bag = request.session.get('bag', {})  # get the bag variable if it exists in the session or create it if it doesn't

    if item_id in list(bag.keys()):
        bag[item_id] += quantity  # update the quantity if the item already exists
    else:
        bag[item_id] = quantity  # add the item 

    request.session['bag'] = bag  # overwrite the variable in the session with the updated version
    print(request.session['bag'])
    return redirect(redirect_url)