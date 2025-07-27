from django.shortcuts import render, get_object_or_404

from .models import UserProfile
from .forms import UserProfileForm


def profile(request):
    """ Display the user's profile. """
    profile = get_object_or_404(UserProfile, user=request.user)

    form = UserProfileForm(instance=profile)  # Populate it with the user's current profile information.
    orders = profile.orders.all()  # orders e related name za Order modelot

    template = 'profiles/profile.html'
    context = {
        'form': form,
    }
    
    return render(request, template, context)