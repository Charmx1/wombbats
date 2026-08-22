const passwordBox = document.getElementById('password');
let entries = [];
let sessionEncryptionKey = null;
let sessionSalt = null;
let selectedEntryIndex = null;
let archiveScrollY = 0;
let lockedDraftTitle = "";
let lockedDraftText = "";
let pendingRestoreBackup = null


passwordBox.addEventListener("keydown", async function(event) {
    if (event.key === "Enter") {
        const enteredPassword = passwordBox.value;


    if (pendingRestoreBackup !== null) {
        const restoreResult =
            await verifyRestorePassword(
            pendingRestoreBackup,
            enteredPassword
        );

            if (restoreResult.success) {
                console.log("BACKUP PASSWORD VERIFIED");

                const restored =
                    await restoreEncryptedBackup(
                        pendingRestoreBackup,
                        restoreResult
                    );

                if (!restored) {
                    console.error("JOURNAL WAS NOT RESTORED");
                    return;
                }

                pendingRestoreBackup = null;

                document.getElementById("login").style.display = "none";
                document.getElementById("journal").style.display = "block";

                editor.style.display = "block";
                archive.style.display = "none";
                postView.style.display = "none";
                changePasswordView.style.display = "none";

                passwordBox.value = "";

                console.log("JOURNAL RESTORED");
            } else {
                console.log("WRONG BACKUP PASSWORD");

                passwordBox.value = "";
                passwordBox.focus();
            }

            return;
        }

        sessionSalt = getOrCreateSalt();

        const passwordKey = await makePasswordKey(enteredPassword);

        const attemptedEncryptionKey = await deriveEncryptionKey(
            passwordKey,
            sessionSalt
        );

        const passwordIsCorrect = await verifyPassword(
            attemptedEncryptionKey
        );

        if (passwordIsCorrect) {
            sessionEncryptionKey = attemptedEncryptionKey;

            await loadStoredEntries();

            document.getElementById("login").style.display = "none";
            document.getElementById("journal").style.display = "block";

            editor.style.display = "block";
            archive.style.display = "none";
            postView.style.display = "none";
            changePasswordView.style.display = "none";

            titleBox.value = lockedDraftTitle;
            entryBox.value = lockedDraftText;

            resetAutoLockTimer();
        } else {
            console.log("INVALID PASSWORD");

            passwordBox.value = "";
            passwordBox.focus();
        }
    }
});



const saveEntryButton = document.getElementById("saveEntry");
const entryList = document.getElementById("entryList");
const showEntriesButton = document.getElementById("showEntries");
const lockButton = document.getElementById("lockButton");
const backupButton = document.getElementById("backupButton");
const searchButton = document.querySelector("#searchButton");
const archiveSearch = document.getElementById("archiveSearch");
const noSearchResults = document.querySelector("#noSearchResults");
const restoreButton = document.getElementById("restoreButton");
const restoreFileInput = document.getElementById("restoreFileInput");
const deleteEntryButton = document.getElementById("deleteEntry");
const entryTags = document.getElementById("entryTags");
const postTags = document.getElementById("postTags");


const showChangePasswordButton = document.getElementById("showChangePassword");
const changePasswordView = document.getElementById("changePasswordView");
const cancelChangePasswordButton = document.getElementById("cancelChangePassword");
const currentPasswordBox = document.getElementById("currentPassword");
const newPasswordBox = document.getElementById("newPassword");
const confirmNewPasswordBox = document.getElementById("confirmNewPassword");
const changePasswordButton = document.getElementById("changePasswordButton");
const changePasswordMessage = document.getElementById("changePasswordMessage");

const backToEditorButton = document.getElementById("backToEditor");
const backToArchiveButton = document.getElementById("backToArchive");

const editor = document.getElementById("editor");
const archive = document.getElementById("archive");

const postView = document.getElementById("postView");
const postTitle = document.getElementById("postTitle");
const postDate = document.getElementById("postDate");
const postBody = document.getElementById("postBody");

const titleBox = document.getElementById("entryTitle");
const entryBox = document.getElementById("entry");


function addEntryToArchive(entry, index) {

    const entryButton = document.createElement("button");

    const entryTitle = document.createElement("span");
        entryTitle.className = "archiveEntryTitle";
        entryTitle.textContent = entry.title || "Untitled";

    const entryDate = document.createElement("span");
        entryDate.className = "archiveEntryDate";
        entryDate.textContent = entry.date;


    const archiveEntryTags = document.createElement("span");
        archiveEntryTags.className = "archiveEntryTags";

        if (entry.tags && entry.tags.length > 0) {
        archiveEntryTags.textContent = entry.tags.join(" · ");
        }

    entryButton.appendChild(entryDate);
    entryButton.appendChild(entryTitle);
    entryButton.appendChild(archiveEntryTags);

    entryButton.addEventListener("click", function() {

    selectedEntryIndex = index;
    postTitle.textContent = entry.title || "Untitled";
    postDate.textContent = entry.date;
    postBody.textContent = entry.text;
    postTags.textContent =
    entry.tags && entry.tags.length > 0
        ? entry.tags.join(" · ")
        : "";

    archiveScrollY = window.scrollY;

    archive.style.display = "none";
    postView.style.display = "block";
});

entryList.appendChild(entryButton);

}

entryBox.addEventListener("keydown", function(event) {
    if (event.key === "Tab") {
        event.preventDefault();

        entryBox.setRangeText(
            "\t",
            entryBox.selectionStart,
            entryBox.selectionEnd,
            "end"
        );
    }
});


function updateArchiveDensity() {
    archive.classList.remove("compact", "dense");

    if (entries.length >= 12) {
        archive.classList.add("dense");
    }   else if (entries.length >= 6) {
        archive.classList.add("compact");
    }
}


async function loadStoredEntries() {
    const storedEntries = JSON.parse(
        localStorage.getItem("journalEntries") || "[]"
    );

    entries = [];
    entryList.innerHTML = "";

    for (let i = 0; i < storedEntries.length; i++) {
        const storedEntry = storedEntries[i];
        const encryptedEntry = storedDataToEncrypted(storedEntry);

        const decryptedText = await decryptText(
            encryptedEntry,
            sessionEncryptionKey
        );

        const entry = JSON.parse(decryptedText);

        entries.push(entry);
        addEntryToArchive(entry, i);
    }

    updateArchiveDensity();

}


saveEntryButton.addEventListener("click", async function() {

    const tags = entryTags.value
        .split(",")
        .map(function(tag) {
            return tag.trim().toLowerCase();
        })
        .filter(function(tag) {
            return tag !== "";
        });




    if (entryBox.value.trim() === "") {
        return;
    }

    const timestamp = new Date().toLocaleString();

    const entry = {
        title: titleBox.value,
        date: timestamp,
        text: entryBox.value,
        tags: tags

    };

    const encryptedEntry = await encryptText(
        JSON.stringify(entry),
        sessionEncryptionKey
    );

    const packedEntry = encryptedDataToStorage(encryptedEntry);

    console.log("2 - ENCRYPTION FINSIHED");

    const storedEntries = JSON.parse(
        localStorage.getItem("journalEntries") || "[]"
    );


    storedEntries.push(packedEntry);

    localStorage.setItem(
        "journalEntries",
        JSON.stringify(storedEntries)
    );

    entries.push(entry);
    addEntryToArchive(entry, entries.length - 1);
    updateArchiveDensity();


    titleBox.value = "";
    entryBox.value = "";
    entryTags.value = "";
    entryBox.focus();
});


showEntriesButton.addEventListener("click", function() {
    editor.style.display = "none";
    archive.style.display = "block";
});

backToEditorButton.addEventListener("click", function() {
    archive.style.display = "none";
    editor.style.display = "block";
});


backToArchiveButton.addEventListener("click", function() {
    postView.style.display = "none";
    archive.style.display = "block";

    requestAnimationFrame(function() {
        window.scrollTo(0, archiveScrollY);
    });
});


searchButton.addEventListener("click", function() {
    archiveSearch.classList.toggle("visible");

    if (archiveSearch.classList.contains("visible")) {
        archiveSearch.focus();
    }
});

archiveSearch.addEventListener("input", function() {
    const searchTerm =
        archiveSearch.value
            .trim()
            .toLowerCase();

    entryList.innerHTML = "";

    entries.forEach(function(entry, index) {
        const title =
            (entry.title || "").toLowerCase();

        const body =
            (entry.text || "").toLowerCase();
        
        const tags =
            (entry.tags || []).join(" ").toLowerCase();

        if (
            title.includes(searchTerm) ||
            body.includes(searchTerm) ||
            tags.includes(searchTerm)
        ) {
            addEntryToArchive(entry, index);
        }
    });

    if  (
        searchTerm !== "" &&
        entryList.children.length === 0
    ) {
        noSearchResults.style.display = "block";
    } else {
        noSearchResults.style.display = "none";
    }

    updateArchiveDensity();
});

deleteEntryButton.addEventListener("click", async function() {
    if (selectedEntryIndex === null) {
        return;
    }

    const shouldDelete = confirm("Delete this entry?");

    if (!shouldDelete) {
        return;
    }

    const storedEntries = JSON.parse(
        localStorage.getItem("journalEntries") || "[]"
    );

    storedEntries.splice(selectedEntryIndex, 1);

    localStorage.setItem(
        "journalEntries",
        JSON.stringify(storedEntries)
    );

    selectedEntryIndex = null;

    await loadStoredEntries();

    postView.style.display = "none";
    archive.style.display = "block";

});


const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function makePasswordKey(password) {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
}

async function deriveEncryptionKey(passwordKey, salt) {
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 250000,
            hash: "SHA-256"
        },
        passwordKey,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptText (text, key) {
    const iv = crypto.getRandomValues (new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encoder.encode(text)
    );

    return{
        iv: iv,
        ciphertext: new Uint8Array(encrypted)
    };
}

async function decryptText(encryptedData, key) {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: encryptedData.iv
        },
        key,
        encryptedData.ciphertext
    );

    return decoder.decode(decrypted);
}


function bytesToBase64(bytes) {
    let binary = "";

    bytes.forEach(function(byte) {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);

    return Uint8Array.from(binary, function(character) {
        return character.charCodeAt(0);
    });
}

function getOrCreateSalt() {
    const storedSalt = localStorage.getItem("journalSalt");

    if (storedSalt) {
        return base64ToBytes(storedSalt);
    }

    const newSalt = crypto.getRandomValues(new Uint8Array(16));

    localStorage.setItem(
        "journalSalt",
        bytesToBase64(newSalt)
    );

    return newSalt;
}


function encryptedDataToStorage(data) {
    return {
        iv: bytesToBase64(data.iv),
        ciphertext: bytesToBase64(data.ciphertext)
    };
}

function storedDataToEncrypted(data) {
    return {
        iv: base64ToBytes(data.iv),
        ciphertext: base64ToBytes(data.ciphertext)
    };
}


async function createPasswordVerifier(encryptionKey) {
    const encryptedVerifier = await encryptText(
        "MORTIS_JOURNAL_UNLOCK",
        encryptionKey
    );

    const packedVerifier = encryptedDataToStorage(encryptedVerifier);

    localStorage.setItem(
        "passwordVerifier",
        JSON.stringify(packedVerifier)
    );
}



async function verifyPassword(encryptionKey) {
    const storedVerifier = localStorage.getItem("passwordVerifier");

    if (!storedVerifier) {
        return false;
    }

    try {
        const packedVerifier = JSON.parse(storedVerifier);

        const encryptedVerifier =
            storedDataToEncrypted(packedVerifier);

        const decryptedVerifier = await decryptText(
            encryptedVerifier,
            encryptionKey
        );

        return decryptedVerifier === "MORTIS_JOURNAL_UNLOCK";
    } catch {
        return false;
    }

}

async function changeJournalPassword(currentPassword, newPassword) {

    const currentPasswordKey = 
        await makePasswordKey (currentPassword);

    const currentEncryptionKey = 
        await deriveEncryptionKey(
            currentPasswordKey,
            sessionSalt
        );

    const currentPasswordIsCorrect = 
        await verifyPassword(currentEncryptionKey);
    if (!currentPasswordIsCorrect) {
        return {
            success: false,
            reason: "wrong-current-password"
        };
    }

    const storedEntries = JSON.parse(
        localStorage.getItem("journalEntries") || "[]"
    );

    const decryptedEntries = [];
    
    for (const storedEntry of storedEntries) {
        const encryptedEntry = 
            storedDataToEncrypted(storedEntry);

        const decryptedText =
            await decryptText(
                encryptedEntry,
                currentEncryptionKey
            );
        decryptedEntries.push(decryptedText);
    }

    const newSalt = 
        crypto.getRandomValues(
            new Uint8Array(16)
        );
    
    const newPasswordKey =
        await makePasswordKey(newPassword);
    
    const newEncryptionKey = 
        await deriveEncryptionKey(
            newPasswordKey,
            newSalt
        );

    const reEncryptedEntries = [];
    for (const decryptedText of decryptedEntries) {
        
        const encryptedEntry =
            await encryptText(
                decryptedText,
                newEncryptionKey
            );

        const packedEntry =
            encryptedDataToStorage(encryptedEntry);
        
        reEncryptedEntries.push(packedEntry);
    }

    const encryptedVerifier =
        await encryptText(
            "MORTIS_JOURNAL_UNLOCK",
            newEncryptionKey
        );
    
    const packedVerifier = 
        encryptedDataToStorage(encryptedVerifier);


    localStorage.setItem(
        "journalEntries",
        JSON.stringify(reEncryptedEntries)
    );

    localStorage.setItem(
            "journalSalt",
            bytesToBase64(newSalt)
    );

    localStorage.setItem(
        "passwordVerifier",
        JSON.stringify(packedVerifier)
    );

    sessionSalt = newSalt;
    sessionEncryptionKey = newEncryptionKey;
        await loadStoredEntries();

        return {
            success: true
        };

}


showChangePasswordButton.addEventListener("click", function() {
    editor.style.display = "none";
    archive.style.display = "none";
    postView.style.display = "none";

    changePasswordView.style.display = "block";

    currentPasswordBox.value = "";
    newPasswordBox.value = "";
    confirmNewPasswordBox.value = "";

    changePasswordMessage.textContent = "";

    currentPasswordBox.focus();
});

cancelChangePasswordButton.addEventListener("click", function() {
    changePasswordView.style.display = "none";
    editor.style.display = "block";

    currentPasswordBox.value = "";
    newPasswordBox.value = "";
    confirmNewPasswordBox.value = "";

    changePasswordMessage.textContent = "";
});

changePasswordButton.addEventListener("click", async function() {
    
    const currentPassword = currentPasswordBox.value;
    const newPassword = newPasswordBox.value;
    const confirmPassword = confirmNewPasswordBox.value;

    if (
        currentPassword === "" ||
        newPassword === "" ||
        confirmPassword === ""
    ) {

        changePasswordMessage.textContent =
            "fill in all password fields";

        return;
     }
    if (newPassword !== confirmPassword) {
        changePasswordMessage.textContent =
            "new passwords do not match";

        newPasswordBox.value = "";
        confirmNewPasswordBox.value = "";
        newPasswordBox.focus();

        return;
    }
    changePasswordButton.disabled = true;

changePasswordMessage.textContent =
    "changing password...";

try {
    const result = await changeJournalPassword(
        currentPassword,
        newPassword
    );

    if (!result.success) {
        if (result.reason === "wrong-current-password") {
            changePasswordMessage.textContent =
                "current password is incorrect";

            currentPasswordBox.value = "";
            currentPasswordBox.focus();
        }

        return;
    }

    changePasswordMessage.textContent =
        "password changed";

    currentPasswordBox.value = "";
    newPasswordBox.value = "";
    confirmNewPasswordBox.value = "";

} catch (error) {
    console.error("PASSWORD CHANGE FAILED:", error);

    changePasswordMessage.textContent =
        "password change failed";

} finally {
    changePasswordButton.disabled = false;
}

});


document.addEventListener("keydown", function(event) {
    if (!event.metaKey) return;

    const key = event.key.toLowerCase();

    if (key === "s") {
        event.preventDefault();

        if (editor.style.display !== "none") {
            saveEntryButton.click();
        }
    }

    if (key === "p") {
        event.preventDefault();

        if (sessionEncryptionKey !== null) {
            showChangePasswordButton.click();
        }
    }

    if (key === "e") {
        event.preventDefault();

        if (sessionEncryptionKey !== null) {
            editor.style.display = "none";
            postView.style.display = "none";
            changePasswordView.style.display = "none";
            archive.style.display = "block";
        }
    }

    if (event.metaKey && event.shiftKey && key === "l") {
        event.preventDefault();

        if (sessionEncryptionKey !== null) {
            lockJournal();
        }
    }
});


function lockJournal(broadcastLock = true) {
    lockedDraftTitle = titleBox.value;
    lockedDraftText = entryBox.value;
    sessionEncryptionKey = null;

    entries = [];
    selectedEntryIndex = null;


    entryList.innerHTML = "";

    postTitle.textContent = "";
    postDate.textContent = "";
    postBody.textContent = "";

    currentPasswordBox.value = "";
    newPasswordBox.value = "";
    confirmNewPasswordBox.value = "";
    changePasswordMessage.textContent = "";

    editor.style.display = "none";
    archive.style.display = "none";
    postView.style.display = "none";
    changePasswordView.style.display = "none";

    document.getElementById("journal").style.display = "none";
    document.getElementById("login").style.display = "flex";


    passwordBox.value = "";
    passwordBox.focus();

    archiveSearch.value = "";
    archiveSearch.classList.remove("visible");
    noSearchResults.style.display = "none";

    if (broadcastLock) {
        localStorage.setItem(
            "mortisLockSignal",
            Date.now().toString()
        );
    }


}

window.addEventListener("storage", function(event) {
    if (event.key === "mortisLockSignal") {
        lockJournal(false);
    }
});


lockButton.addEventListener("click", lockJournal);

let autoLockTimer;

const AUTO_LOCK_MINUTES = 10;

function resetAutoLockTimer() {
    clearTimeout(autoLockTimer);

    if (sessionEncryptionKey === null) {
        return;
    }

    autoLockTimer = setTimeout(function() {
        if (sessionEncryptionKey !== null) {
            lockJournal();
        }
    }, AUTO_LOCK_MINUTES * 60 * 1000);
}

["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(function(eventName) {
    document.addEventListener(eventName, resetAutoLockTimer);
});


function exportEncryptedbackup() {
    console.log("BACKUP CLICKED");
    const storedEntries = localStorage.getItem("journalEntries");
    const storedSalt = localStorage.getItem("journalSalt");
    const storedVerifier = localStorage.getItem("passwordVerifier");

    if (!storedEntries || !storedSalt || !storedVerifier) {
        console.error("BACKUP FAILED: journal data is incomplete");
        return;
    }

    const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),

        journalSalt: storedSalt,
        passwordVerifier: JSON.parse(storedVerifier),
        journalEntries: JSON.parse(storedEntries)
    };

    const backupText = JSON.stringify(backup, null, 2);

    const backupBlob = new Blob(
        [backupText],
        { type: "application/json" }
    );

    const backupURL = URL.createObjectURL(backupBlob);

    const downloadLink = document.createElement("a");

    const date = new Date()
        .toISOString()
        .slice(0, 10);
    
    downloadLink.href = backupURL;
    downloadLink.download =
    `journal-backup-${date}.json`;

    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    URL.revokeObjectURL(backupURL);
    
}


backupButton.addEventListener("click", exportEncryptedbackup);

restoreButton.addEventListener("click", function(){
    restoreFileInput.click();
});

restoreFileInput.addEventListener("change", async function() {
    const file = restoreFileInput.files[0];

    if (!file) return;

    try {
        const fileText = await file.text();
        const backup = JSON.parse(fileText);

        const isValidBackup = 
            backup.version === 1 &&
            typeof backup.journalSalt === "string" &&
            backup.passwordVerifier &&
            typeof backup.passwordVerifier.iv === "string" &&
            typeof backup.passwordVerifier.ciphertext === "string" &&
            Array.isArray(backup.journalEntries);
            
            if (!isValidBackup) {
                console.error("INVALID JOURNAL BACKUP");
                restoreFileInput.value = "";
                return;
            }

            pendingRestoreBackup = backup;
            console.log("VALID JOURNAL BACKUP");
    } catch (error) {
        console.error("COULD NOT READ BACKUP", error);
    }

    restoreFileInput.value = "";
});

async function verifyRestorePassword(backup, password) {
    try{
        const backupSalt =
            base64ToBytes(backup.journalSalt);
        
        const passwordKey =
            await makePasswordKey(password);

        const backupEncryptionKey =
            await deriveEncryptionKey(
                passwordKey,
                backupSalt
        );
        
        const encryptedVerifier =
            storedDataToEncrypted(
                backup.passwordVerifier
            );
        
        const decryptedVerifier =
            await decryptText(
                encryptedVerifier,
                backupEncryptionKey
            );

        return {
            success:
                decryptedVerifier ===
                "MORTIS_JOURNAL_UNLOCK",

                encryptionKey:
                    backupEncryptionKey,
                
                salt:
                    backupSalt
        };
    } catch {
        return {
            success: false
        };
    }
}

async function restoreEncryptedBackup(backup, restoreResult) {
    const oldEntries = localStorage.getItem("journalEntries");
    const oldSalt = localStorage.getItem("journalSalt");
    const oldVerifier = localStorage.getItem("passwordVerifier");

    try {
        localStorage.setItem(
            "journalEntries",
            JSON.stringify(backup.journalEntries)
        );

        localStorage.setItem(
            "journalSalt",
            backup.journalSalt
        );

        localStorage.setItem(
            "passwordVerifier",
            JSON.stringify(backup.passwordVerifier)
        );

        sessionSalt = restoreResult.salt;
        sessionEncryptionKey = restoreResult.encryptionKey;

        await loadStoredEntries();

        return true;
    } catch (error) {
        console.error("RESTORE FAILED", error);

        if (oldEntries === null) {
            localStorage.removeItem("journalEntries");
        }
        
        if (oldSalt === null) {
            localStorage.removeItem("journalSalt");
        } else {
            localStorage.setItem ("journalSalt", oldSalt);
        }

        if (oldVerifier === null) {
            localStorage.removeItem('passwordVerifier');
        }

        return false;
    }
}
