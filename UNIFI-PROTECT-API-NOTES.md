# UniFi Protect API Notes

## API Investigation Results

### Working Endpoints
- `/proxy/protect/integration/v1/meta/info` - Returns version info (v6.0.30)
- `/api/system` - Returns system info but in HTML format

### Authentication Issues
Most API endpoints return 401 Unauthorized with the API key alone:
- `/proxy/protect/api/cameras`
- `/proxy/protect/api/devices`
- `/proxy/protect/api/discover`
- `/proxy/protect/api/adoption/candidates`

### Key Findings
1. The API key authentication seems to only work for limited endpoints
2. Full API access likely requires cookie-based authentication (login session)
3. The integration API (v1) has limited functionality compared to the main API

## Potential Adoption Automation Approaches

### 1. Browser Automation
- Use Puppeteer or Playwright to automate the web UI
- Login, navigate to camera adoption page
- Automate clicking "Adopt" for each camera

### 2. Session-Based API
- Perform login to get session cookie
- Use session cookie for API requests
- POST to adoption endpoint with camera details

### 3. WebSocket Discovery
- Monitor WebSocket connections during manual adoption
- Reverse engineer the adoption protocol
- Implement direct adoption via WebSocket

### 4. ONVIF Device Improvements
- Investigate what makes UniFi Protect limit adoption
- Potentially randomize device characteristics more
- Add delays between camera startups

## Example: Session-Based Approach (Theoretical)
```javascript
// 1. Login to get session
const loginResponse = await fetch('https://192.168.6.221/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
        username: 'admin',
        password: 'password'
    })
});
const cookies = loginResponse.headers['set-cookie'];

// 2. Get unadopted devices
const devicesResponse = await fetch('https://192.168.6.221/proxy/protect/api/discover', {
    headers: {
        'Cookie': cookies
    }
});

// 3. Adopt each device
for (const device of devices) {
    await fetch('https://192.168.6.221/proxy/protect/api/cameras/adopt', {
        method: 'POST',
        headers: {
            'Cookie': cookies
        },
        body: JSON.stringify({
            mac: device.mac,
            name: device.name
        })
    });
}
```

## Recommendations

1. **Short term**: Continue with the current one-by-one adoption script
2. **Medium term**: Investigate browser automation for faster adoption
3. **Long term**: Reverse engineer the full adoption protocol

## Additional Notes

- UniFi Protect seems to use a combination of ONVIF discovery and proprietary protocols
- The adoption limitation might be intentional for security reasons
- Consider reaching out to Ubiquiti community for insights on batch adoption