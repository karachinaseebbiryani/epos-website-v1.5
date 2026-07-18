// Hosted-gateway redirect helper.
// The backend's /payments/{gateway}/create-session returns
// { action_url, method, ref, fields } — this builds a hidden form and
// submits it so the browser navigates to the gateway's hosted page
// (the same thing the mobile app's payment webview does).
export function submitGatewayForm(actionUrl, fields) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = actionUrl;
    form.style.display = "none";
    Object.entries(fields || {}).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v == null ? "" : String(v);
        form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
}
