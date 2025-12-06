# Why Am I Already Signed In?

## Firebase Authentication Persistence

Firebase Authentication **automatically saves your login session** in your browser. This means:

✅ **You stay signed in** even after:
- Closing the browser
- Closing the tab
- Restarting your computer
- Coming back days later

This is **normal behavior** and provides a better user experience - you don't have to sign in every time!

## How It Works

1. When you sign in, Firebase saves your authentication token in browser storage
2. When you visit the site again, Firebase automatically checks for this token
3. If found, you're automatically signed in

## How to Sign Out

To sign out and test the login flow:

1. **On Home Page**: Click "Sign Out" button (top right)
2. **On Donor/Claimer Pages**: Click "Sign Out" button (top right)
3. **Clear Browser Data** (if sign out doesn't work):
   - Chrome: Settings > Privacy > Clear browsing data > Cookies
   - Firefox: Settings > Privacy > Clear Data > Cookies
   - Edge: Settings > Privacy > Clear browsing data > Cookies

## Testing Login Flow

If you want to test the login requirement:

1. Click "Sign Out" on any page
2. Try clicking "I'm a Donor" or "I'm a Claimer"
3. You should be redirected to the login page
4. After signing in, you'll be redirected back to the page you wanted

## Session Duration

- **Default**: Sessions last until you explicitly sign out
- **No automatic timeout**: Firebase doesn't automatically sign you out
- **Cross-device**: Signing in on one device doesn't sign you in on others

## Security Note

This is secure because:
- Authentication tokens are stored securely in browser storage
- Tokens are encrypted and tied to your browser
- Each device/browser has its own session
- You can sign out at any time

## If You Want to Disable Persistence

If you want users to sign in every time (not recommended for UX), you would need to:
1. Sign out on page close
2. Clear tokens on browser close
3. This would require custom implementation and is not standard practice

**Recommendation**: Keep the current behavior - it's the standard for web applications and provides the best user experience!

