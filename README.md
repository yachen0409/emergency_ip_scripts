# Emergency IP Scripts
## Usage
- Use with Frida
- For Pixel series:
    - `frida -U -n com.shannon.imsservice -l pixel9_get_emergency_ip.js`
- For Samsung Galaxy series
    - `frida -U -n com.sec.imsservice -l s24_get_emergency_ip.js`