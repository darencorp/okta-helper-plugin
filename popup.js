(() => {
  "use strict";

  const usernameInput = document.getElementById("username");
  const rememberMeCheckbox = document.getElementById("rememberMe");
  const autoNextCheckbox = document.getElementById("autoNext");
  const saveBtn = document.getElementById("saveBtn");
  const statusEl = document.getElementById("status");

  // Load saved settings when the popup opens.
  chrome.storage.sync.get(
    { username: "", rememberMe: true, autoNext: false },
    (settings) => {
      usernameInput.value = settings.username;
      rememberMeCheckbox.checked = settings.rememberMe;
      autoNextCheckbox.checked = settings.autoNext;
    }
  );

  // Save settings when the button is clicked.
  saveBtn.addEventListener("click", () => {
    const username = usernameInput.value.trim();

    chrome.storage.sync.set(
      {
        username,
        rememberMe: rememberMeCheckbox.checked,
        autoNext: autoNextCheckbox.checked,
      },
      () => {
        if (chrome.runtime.lastError) {
          showStatus("Error saving settings.", true);
        } else {
          showStatus("Settings saved!");
        }
      }
    );
  });

  function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
    statusEl.classList.add("visible");
    setTimeout(() => statusEl.classList.remove("visible"), 2000);
  }
})();
