const reconnectBtn = document.getElementById("reconnectBtn");
const actionNote = document.getElementById("actionNote");

if (reconnectBtn) {
	reconnectBtn.addEventListener("click", () => {
		reconnectBtn.disabled = true;
		reconnectBtn.textContent = "Reconnecting...";
		chrome.runtime.sendMessage({ type: "RECONNECT" }, (response) => {
			const ok = response && response.ok;
			actionNote.textContent = ok ? "Reconnected" : "Reconnect failed";
			reconnectBtn.textContent = "Reconnect";
			reconnectBtn.disabled = false;
		});
	});
}
