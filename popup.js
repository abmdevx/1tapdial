const reconnectBtn = document.getElementById("reconnectBtn");
const reconnectLabel = document.getElementById("reconnectLabel");
const actionNote = document.getElementById("actionNote");
const hero = document.getElementById("hero");
const heroTitle = document.getElementById("heroTitle");
const heroSub = document.getElementById("heroSub");
const versionEl = document.getElementById("version");

const connections = {
	voice: {
		row: document.getElementById("connVoice"),
		chip: document.getElementById("voiceChip"),
		pattern: "*://voice.google.com/*",
	},
	sheets: {
		row: document.getElementById("connSheets"),
		chip: document.getElementById("sheetsChip"),
		pattern: "*://docs.google.com/spreadsheets/*",
	},
};

function setConnection(conn, isOpen) {
	conn.row.dataset.ok = String(isOpen);
	conn.chip.textContent = isOpen ? "Connected" : "Not open";
}

function setHero(state, title, sub) {
	hero.dataset.state = state;
	heroTitle.textContent = title;
	heroSub.textContent = sub;
}

function queryTabs(pattern) {
	return new Promise((resolve) => {
		chrome.tabs.query({ url: pattern }, (tabs) => resolve(tabs || []));
	});
}

async function refreshStatus() {
	const [voiceTabs, sheetsTabs] = await Promise.all([
		queryTabs(connections.voice.pattern),
		queryTabs(connections.sheets.pattern),
	]);
	const voiceOpen = voiceTabs.length > 0;
	const sheetsOpen = sheetsTabs.length > 0;

	setConnection(connections.voice, voiceOpen);
	setConnection(connections.sheets, sheetsOpen);

	if (voiceOpen && sheetsOpen) {
		setHero("ready", "Ready to dial", "Click a phone cell in Sheets");
	} else if (!voiceOpen && !sheetsOpen) {
		setHero("waiting", "Open your tabs", "Google Voice and a Google Sheet");
	} else if (!voiceOpen) {
		setHero("waiting", "Open Google Voice", "Sign in and keep the tab open");
	} else {
		setHero("waiting", "Open a Google Sheet", "Then click a phone cell");
	}
}

if (versionEl && chrome.runtime.getManifest) {
	versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
}

if (reconnectBtn) {
	reconnectBtn.addEventListener("click", () => {
		reconnectBtn.disabled = true;
		reconnectBtn.classList.add("spin");
		reconnectLabel.textContent = "Reconnecting…";
		chrome.runtime.sendMessage({ type: "RECONNECT" }, (response) => {
			const ok = response && response.ok;
			actionNote.textContent = ok ? "Reconnected" : "Reconnect failed";
			reconnectLabel.textContent = "Reconnect";
			reconnectBtn.classList.remove("spin");
			reconnectBtn.disabled = false;
			refreshStatus();
		});
	});
}

refreshStatus();
