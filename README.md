# Emergency IP Scripts
## Usage
- Use with Frida
- Launch the script
    - For Pixel series:
        - `frida -U -n com.shannon.imsservice -l pixel_emerg_conn.js`
    - For Samsung Galaxy series
        - `frida -U -n com.sec.imsservice -l samsung_emerg_conn.js`
- Get Emergency IP
    - Enter `enable()` in **Frida CLI**
- Disconnect from Emergency Network
    - Enter `disable()` in **Frida CLI**
- Detach the script
    - Enter `exit` in **Frida CLI**