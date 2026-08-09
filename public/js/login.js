document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  const btn = document.getElementById('loginBtn');

  errorMsg.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.error || 'Unable to sign in.';
      errorMsg.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }

    sessionStorage.setItem('kranti_user', JSON.stringify(data));
    window.location.href = 'dashboard.html';
  } catch (err) {
    errorMsg.textContent = 'Could not reach the server.';
    errorMsg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});
