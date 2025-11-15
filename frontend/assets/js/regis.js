// regis.js

// Asumsi: API_URL dimuat dari utils.js

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const messageDiv = document.getElementById("message");

  // Fungsi helper untuk menampilkan pesan
  function displayMessage(message, type = "danger") {
    if (typeof setMessage !== "undefined") {
      // Jika fungsi setMessage dari utils.js tersedia
      setMessage(message, type, "message");
    } else {
      // Fallback jika utils.js tidak dimuat
      messageDiv.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
      messageDiv.style.display = "block";
      setTimeout(() => {
        messageDiv.style.display = "none";
      }, 3000);
    }
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Bersihkan pesan sebelumnya
      messageDiv.style.display = "none";

      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      const submitButton = registerForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "Memproses...";

      const userPayload = { username, email, password };

      try {
        // Ambil API_URL dari utils.js, atau gunakan fallback
        const apiUrl = typeof API_URL !== "undefined" ? `${API_URL}/auth/register` : "http://localhost:3000/api/auth/register";

        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userPayload),
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text || "Respons tidak dapat dibaca." };
        }

        if (!res.ok) {
          displayMessage(`ERROR: ${data.error || data.message || "Registrasi gagal."}`, "danger");
        } else {
          displayMessage(`${data.message || "Registrasi berhasil! Anda akan dialihkan ke halaman Login."}`, "success");
          registerForm.reset();

          // Alihkan ke login setelah sukses
          setTimeout(() => {
            window.location.href = "login.html";
          }, 2000);
        }
      } catch (error) {
        console.error(error);
        displayMessage(`Tidak dapat terhubung ke API Gateway. Cek konsol.`, "danger");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Register";
      }
    });
  }
});
