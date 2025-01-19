from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    photo = models.ImageField(upload_to='user_photos', blank=True, null=True)
    # Uploaded photos go to 'media/user_photos/'
    friends = models.ManyToManyField('self', symmetrical=False, related_name='friend_of', blank=True)
    online_status = models.BooleanField(default=False)
    language = models.CharField(max_length=10, default="")
    two_fa = models.BooleanField(default=False)
    totp_secret = models.CharField(max_length=32, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

    def add_friend(self, profile):
        self.friends.add(profile)
    
    def remove_friend(self, profile):
        self.friends.remove(profile)
    
    def is_friend_already(self, profile):
        return self.friends.filter(pk=profile.pk).exists()