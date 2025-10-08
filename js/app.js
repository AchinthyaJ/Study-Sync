// ===========================
// GLOBAL STATE
// ===========================
let appwriteClient;
let appwriteDatabase;
let currentRoom = null;
let currentRoomId = null;
let currentRoomPassword = null;
let userId = 'user_' + Math.random().toString(36).substr(2, 9);
let username = localStorage.getItem('studysync_username') || '';

// Canvas state
let canvasScale = 1;
let canvasOffsetX = 0;
let canvasOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Node state
let nodes = {}; // Store all nodes by ID
let connections = []; // Store all connections
let draggedNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Connection mode
let connectionMode = false;
let connectionStartNode = null;

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initializeAppwrite();
    initializeEventListeners();
    showRoomModal();
});

function initializeAppwrite() {
    const { Client, Databases, Query } = window.Appwrite;

    appwriteClient = new Client()
        .setEndpoint(appwriteConfig.endpoint)
        .setProject(appwriteConfig.projectId);

    appwriteDatabase = new Databases(appwriteClient);

    console.log('StudySync Canvas initialized');
}

// ===========================
// ROOM MANAGEMENT
// ===========================
function showRoomModal() {
    document.getElementById('room-modal').classList.remove('hidden');

    // Pre-fill username if stored
    if (username) {
        document.getElementById('modal-username').value = username;
    }
}

function hideRoomModal() {
    document.getElementById('room-modal').classList.add('hidden');
}

document.getElementById('modal-join-btn').addEventListener('click', async () => {
    const usernameInput = document.getElementById('modal-username').value.trim();
    const roomCode = document.getElementById('modal-room-code').value.trim();
    const roomPassword = document.getElementById('modal-room-password').value.trim();
    const errorDiv = document.getElementById('modal-error');

    if (!usernameInput) {
        errorDiv.textContent = 'Please enter your name';
        return;
    }

    if (!roomCode || !roomPassword) {
        errorDiv.textContent = 'Please enter both room code and password';
        return;
    }

    // Store username
    username = usernameInput;
    localStorage.setItem('studysync_username', username);

    try {
        errorDiv.textContent = 'Joining room...';

        // Check if room exists
        const { Query } = window.Appwrite;
        const rooms = await appwriteDatabase.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.roomsCollectionId,
            [Query.equal('roomCode', roomCode)]
        );

        if (rooms.documents.length > 0) {
            // Room exists - verify password
            const room = rooms.documents[0];
            if (room.password === roomPassword) {
                currentRoom = roomCode;
                currentRoomId = room.$id;
                currentRoomPassword = roomPassword;
                hideRoomModal();
                initializeRoom();
            } else {
                errorDiv.textContent = 'Incorrect password';
            }
        } else {
            // Create new room
            const newRoom = await appwriteDatabase.createDocument(
                appwriteConfig.databaseId,
                appwriteConfig.roomsCollectionId,
                'unique()',
                {
                    roomCode: roomCode,
                    password: roomPassword,
                    createdAt: new Date().toISOString()
                }
            );
            currentRoom = roomCode;
            currentRoomId = newRoom.$id;
            currentRoomPassword = roomPassword;
            hideRoomModal();
            initializeRoom();
        }
    } catch (error) {
        console.error('Error joining room:', error);
        errorDiv.textContent = 'Error: ' + error.message;
    }
});

async function initializeRoom() {
    console.log('Joined room:', currentRoom);

    // Update user info display
    document.getElementById('user-info').textContent = `${username} • Room: ${currentRoom}`;

    // Show invite button
    document.getElementById('invite-btn').classList.remove('hidden');

    // Load existing nodes
    await loadNodes();

    // Load existing connections
    await loadConnections();

    // Load existing chat messages
    await loadChatMessages();

    // Subscribe to realtime updates
    subscribeToRealtimeUpdates();
}

// ===========================
// CANVAS PAN & ZOOM
// ===========================
function initializeEventListeners() {
    const canvasArea = document.getElementById('canvas-area');
    const viewport = document.getElementById('canvas-viewport');

    // Pan functionality
    canvasArea.addEventListener('mousedown', (e) => {
        if (e.target === canvasArea || e.target === viewport || e.target.tagName === 'svg') {
            isPanning = true;
            panStartX = e.clientX - canvasOffsetX;
            panStartY = e.clientY - canvasOffsetY;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            canvasOffsetX = e.clientX - panStartX;
            canvasOffsetY = e.clientY - panStartY;
            updateCanvasTransform();
        }

        if (draggedNode) {
            const rect = viewport.getBoundingClientRect();
            const x = (e.clientX - rect.left - canvasOffsetX) / canvasScale - dragOffsetX;
            const y = (e.clientY - rect.top - canvasOffsetY) / canvasScale - dragOffsetY;

            draggedNode.style.left = x + 'px';
            draggedNode.style.top = y + 'px';

            updateConnectionLines();
        }
    });

    document.addEventListener('mouseup', async () => {
        isPanning = false;

        if (draggedNode) {
            draggedNode.classList.remove('dragging');

            // Update node position in database
            const nodeId = draggedNode.dataset.nodeId;
            const x = Math.floor(parseFloat(draggedNode.style.left));
            const y = Math.floor(parseFloat(draggedNode.style.top));

            await updateNodePosition(nodeId, x, y);

            draggedNode = null;
        }
    });

    // Touch events for mobile panning
    canvasArea.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        if (e.target === canvasArea || e.target === viewport || e.target.tagName === 'svg') {
            isPanning = true;
            panStartX = touch.clientX - canvasOffsetX;
            panStartY = touch.clientY - canvasOffsetY;
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (isPanning) {
            const touch = e.touches[0];
            canvasOffsetX = touch.clientX - panStartX;
            canvasOffsetY = touch.clientY - panStartY;
            updateCanvasTransform();
            e.preventDefault();
        }

        if (draggedNode) {
            const touch = e.touches[0];
            const rect = viewport.getBoundingClientRect();
            const x = (touch.clientX - rect.left - canvasOffsetX) / canvasScale - dragOffsetX;
            const y = (touch.clientY - rect.top - canvasOffsetY) / canvasScale - dragOffsetY;

            draggedNode.style.left = x + 'px';
            draggedNode.style.top = y + 'px';

            updateConnectionLines();
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchend', async () => {
        isPanning = false;

        if (draggedNode) {
            draggedNode.classList.remove('dragging');

            // Update node position in database
            const nodeId = draggedNode.dataset.nodeId;
            const x = Math.floor(parseFloat(draggedNode.style.left));
            const y = Math.floor(parseFloat(draggedNode.style.top));

            await updateNodePosition(nodeId, x, y);

            draggedNode = null;
        }
    });

    // Zoom functionality
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
        canvasScale = Math.min(canvasScale + 0.1, 2);
        updateCanvasTransform();
    });

    document.getElementById('zoom-out-btn').addEventListener('click', () => {
        canvasScale = Math.max(canvasScale - 0.1, 0.5);
        updateCanvasTransform();
    });

    document.getElementById('zoom-reset-btn').addEventListener('click', () => {
        canvasScale = 1;
        canvasOffsetX = 0;
        canvasOffsetY = 0;
        updateCanvasTransform();
    });

    // Toolbar buttons
    document.getElementById('add-note-btn').addEventListener('click', () => createNode('note', ''));
    document.getElementById('add-flashcard-btn').addEventListener('click', () => createNode('flashcard', JSON.stringify({ question: '', answer: '' })));
    document.getElementById('add-quiz-btn').addEventListener('click', () => createNode('quiz', JSON.stringify({ question: '', options: ['', '', '', ''], correctIndex: 0 })));

    // Chat functionality
    document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Invite functionality
    document.getElementById('invite-btn').addEventListener('click', showInviteModal);
    document.getElementById('invite-close-btn').addEventListener('click', hideInviteModal);
    document.getElementById('invite-copy-btn').addEventListener('click', copyInviteText);

    // Export to PDF functionality
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
}

// ===========================
// INVITE SYSTEM
// ===========================
function showInviteModal() {
    const inviteModal = document.getElementById('invite-modal');
    const inviteText = document.getElementById('invite-text');

    // Generate invite text
    const inviteMessage = `Join the study room in https://studysync-aj.vercel.app

Room ID: ${currentRoom}
Password: ${currentRoomPassword}`;

    inviteText.textContent = inviteMessage;
    inviteModal.classList.remove('hidden');
}

function hideInviteModal() {
    const inviteModal = document.getElementById('invite-modal');
    inviteModal.classList.add('hidden');

    // Reset copy button
    const copyBtn = document.getElementById('invite-copy-btn');
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.classList.remove('copied');
}

async function copyInviteText() {
    const inviteText = document.getElementById('invite-text').textContent;
    const copyBtn = document.getElementById('invite-copy-btn');

    try {
        await navigator.clipboard.writeText(inviteText);
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');

        setTimeout(() => {
            copyBtn.textContent = 'Copy to Clipboard';
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (error) {
        console.error('Failed to copy:', error);
        alert('Failed to copy to clipboard');
    }
}

function updateCanvasTransform() {
    const viewport = document.getElementById('canvas-viewport');
    viewport.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${canvasScale})`;
}

// ===========================
// PDF EXPORT
// ===========================
async function exportToPDF() {
    if (!currentRoom) {
        alert('Please join a room first');
        return;
    }

    // Check if there are any nodes to export
    const nodeCount = Object.keys(nodes).length;
    if (nodeCount === 0) {
        alert('No content to export. Add some notes, flashcards, or quizzes first!');
        return;
    }

    try {
        // Get jsPDF from the global window object
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // PDF settings
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const maxWidth = pageWidth - (margin * 2);
        let yPosition = margin;

        // Helper function to add a new page if needed
        function checkAndAddPage(requiredSpace = 20) {
            if (yPosition + requiredSpace > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
                return true;
            }
            return false;
        }

        // Helper function to wrap text
        function addWrappedText(text, x, y, maxWidth, fontSize = 12) {
            doc.setFontSize(fontSize);
            const lines = doc.splitTextToSize(text, maxWidth);
            lines.forEach((line, index) => {
                checkAndAddPage();
                doc.text(line, x, y + (index * 7));
                yPosition = y + ((index + 1) * 7);
            });
            return lines.length;
        }

        // Title
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('StudySync Canvas Export', margin, yPosition);
        yPosition += 15;

        // Room info
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100);
        doc.text(`Room: ${currentRoom}`, margin, yPosition);
        yPosition += 7;
        doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
        yPosition += 15;

        // Separate nodes by type
        const noteNodes = [];
        const flashcardNodes = [];
        const quizNodes = [];

        Object.keys(nodes).forEach(nodeId => {
            const node = nodes[nodeId];
            if (node.type === 'note') noteNodes.push(nodeId);
            else if (node.type === 'flashcard') flashcardNodes.push(nodeId);
            else if (node.type === 'quiz') quizNodes.push(nodeId);
        });

        // Fetch all node data from database
        const nodeData = {};
        for (const nodeId of Object.keys(nodes)) {
            try {
                const doc = await appwriteDatabase.getDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.nodesCollectionId,
                    nodeId
                );
                nodeData[nodeId] = doc;
            } catch (error) {
                console.error('Error fetching node:', nodeId, error);
            }
        }

        // Export Notes
        if (noteNodes.length > 0) {
            checkAndAddPage(20);
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(59, 130, 246); // Blue color
            doc.text('Notes', margin, yPosition);
            yPosition += 10;

            noteNodes.forEach((nodeId, index) => {
                const data = nodeData[nodeId];
                if (!data) return;

                checkAndAddPage(30);

                // Note number
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0);
                doc.text(`Note ${index + 1}`, margin, yPosition);
                yPosition += 10;

                // Note content
                doc.setFont(undefined, 'normal');
                doc.setTextColor(60);
                const content = data.content || 'Empty note';
                addWrappedText(content, margin, yPosition, maxWidth, 11);
                yPosition += 10;
            });
        }

        // Export Flashcards
        if (flashcardNodes.length > 0) {
            checkAndAddPage(20);
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(139, 92, 246); // Purple color
            doc.text('Flashcards', margin, yPosition);
            yPosition += 10;

            flashcardNodes.forEach((nodeId, index) => {
                const data = nodeData[nodeId];
                if (!data) return;

                try {
                    const flashcardData = JSON.parse(data.content);

                    checkAndAddPage(40);

                    // Flashcard number
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(0);
                    doc.text(`Flashcard ${index + 1}`, margin, yPosition);
                    yPosition += 10;

                    // Question
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(139, 92, 246);
                    doc.text('Q:', margin, yPosition);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(60);
                    addWrappedText(flashcardData.question || 'No question', margin + 10, yPosition, maxWidth - 10, 11);
                    yPosition += 5;

                    // Answer
                    checkAndAddPage(15);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(139, 92, 246);
                    doc.text('A:', margin, yPosition);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(60);
                    addWrappedText(flashcardData.answer || 'No answer', margin + 10, yPosition, maxWidth - 10, 11);
                    yPosition += 10;
                } catch (error) {
                    console.error('Error parsing flashcard:', error);
                }
            });
        }

        // Export Quizzes
        if (quizNodes.length > 0) {
            checkAndAddPage(20);
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(16, 185, 129); // Green color
            doc.text('Quizzes', margin, yPosition);
            yPosition += 10;

            quizNodes.forEach((nodeId, index) => {
                const data = nodeData[nodeId];
                if (!data) return;

                try {
                    const quizData = JSON.parse(data.content);

                    checkAndAddPage(50);

                    // Quiz number
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(0);
                    doc.text(`Quiz ${index + 1}`, margin, yPosition);
                    yPosition += 10;

                    // Question
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(60);
                    addWrappedText(quizData.question || 'No question', margin, yPosition, maxWidth, 11);
                    yPosition += 5;

                    // Options
                    doc.setFont(undefined, 'normal');
                    quizData.options.forEach((option, optionIndex) => {
                        checkAndAddPage(10);

                        const isCorrect = optionIndex === quizData.correctIndex;

                        if (isCorrect) {
                            doc.setTextColor(16, 185, 129); // Green for correct answer
                            doc.setFont(undefined, 'bold');
                        } else {
                            doc.setTextColor(100);
                            doc.setFont(undefined, 'normal');
                        }

                        const prefix = isCorrect ? `${optionIndex + 1}. ✓ ` : `${optionIndex + 1}. `;
                        addWrappedText(prefix + option, margin + 5, yPosition, maxWidth - 5, 10);
                        yPosition += 2;
                    });

                    yPosition += 10;
                } catch (error) {
                    console.error('Error parsing quiz:', error);
                }
            });
        }

        // Add footer to all pages
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.setFont(undefined, 'normal');
            doc.text(
                `Page ${i} of ${pageCount} • Generated by StudySync`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
        }

        // Save the PDF
        const filename = `StudySync_${currentRoom}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        console.log('PDF exported successfully');
    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Error exporting to PDF: ' + error.message);
    }
}

// ===========================
// NODE MANAGEMENT
// ===========================
async function createNode(type, content) {
    try {
        const x = Math.floor(Math.random() * 400 + 100);
        const y = Math.floor(Math.random() * 300 + 100);

        const nodeData = {
            type: type,
            content: content,
            x: x,
            y: y,
            roomCode: currentRoom,
            timestamp: new Date().toISOString()
        };

        const newNode = await appwriteDatabase.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.nodesCollectionId,
            'unique()',
            nodeData
        );

        renderNode(newNode);
    } catch (error) {
        console.error('Error creating node:', error);
        alert('Error creating node: ' + error.message);
    }
}

function renderNode(nodeDoc) {
    const nodeId = nodeDoc.$id;
    const type = nodeDoc.type;
    const content = nodeDoc.content;
    const x = nodeDoc.x;
    const y = nodeDoc.y;

    // Check if node already exists
    if (nodes[nodeId]) {
        // Update existing node position
        nodes[nodeId].element.style.left = x + 'px';
        nodes[nodeId].element.style.top = y + 'px';
        return;
    }

    const viewport = document.getElementById('canvas-viewport');
    const nodeDiv = document.createElement('div');
    nodeDiv.className = `node node-${type}`;
    nodeDiv.dataset.nodeId = nodeId;
    nodeDiv.style.left = x + 'px';
    nodeDiv.style.top = y + 'px';

    // Determine if node is empty (should start in edit mode)
    let isEmpty = !content || content === '';
    if (!isEmpty && type !== 'note') {
        try {
            const data = JSON.parse(content);
            isEmpty = !data.question || data.question === '';
        } catch (e) {
            isEmpty = true;
        }
    }

    // Create initial content (edit mode for empty nodes, view mode for filled)
    nodeDiv.innerHTML = `
        <div class="node-header">
            <span class="node-type-badge">${type}</span>
            <span class="node-delete-btn" onclick="deleteNode('${nodeId}')">×</span>
        </div>
        <div class="node-content"></div>
    `;

    const contentDiv = nodeDiv.querySelector('.node-content');

    // Render in appropriate mode
    if (isEmpty) {
        renderNodeEditMode(nodeId, type, content, contentDiv);
    } else {
        renderNodeViewMode(nodeId, type, content, contentDiv);
    }

    // Make node draggable
    nodeDiv.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('node-delete-btn')) return;
        if (e.target.classList.contains('node-action-btn')) return;
        if (e.target.classList.contains('quiz-option-btn')) return;
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

        e.stopPropagation();
        draggedNode = nodeDiv;
        nodeDiv.classList.add('dragging');

        const rect = nodeDiv.getBoundingClientRect();
        dragOffsetX = (e.clientX - rect.left) / canvasScale;
        dragOffsetY = (e.clientY - rect.top) / canvasScale;
    });

    // Touch support for node dragging
    nodeDiv.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('node-delete-btn')) return;
        if (e.target.classList.contains('node-action-btn')) return;
        if (e.target.classList.contains('quiz-option-btn')) return;
        if (e.target.classList.contains('flashcard-view') || e.target.closest('.flashcard-view')) return;
        if (e.target.classList.contains('flashcard-side') || e.target.classList.contains('flashcard-label')) return;
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

        e.stopPropagation();
        e.preventDefault();
        const touch = e.touches[0];
        draggedNode = nodeDiv;
        nodeDiv.classList.add('dragging');

        const rect = nodeDiv.getBoundingClientRect();
        dragOffsetX = (touch.clientX - rect.left) / canvasScale;
        dragOffsetY = (touch.clientY - rect.top) / canvasScale;
    }, { passive: false });

    // Focus first input if empty
    if (isEmpty) {
        setTimeout(() => {
            const firstInput = nodeDiv.querySelector('textarea, input[type="text"]');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    viewport.appendChild(nodeDiv);

    // Store node reference
    nodes[nodeId] = {
        element: nodeDiv,
        x: x,
        y: y,
        type: type
    };
}

// Render node in VIEW mode (interactive flashcards/quizzes)
function renderNodeViewMode(nodeId, type, content, contentDiv) {
    const nodeDiv = contentDiv.parentElement;

    if (type === 'note') {
        const noteContent = content || 'Empty note';
        contentDiv.innerHTML = `
            <div style="white-space: pre-wrap; padding: 8px;">${noteContent}</div>
            <div class="node-actions">
                <button class="node-action-btn primary" onclick="switchToEditMode('${nodeId}')">Edit</button>
                <button class="node-action-btn connection-btn" onclick="toggleConnectionMode('${nodeId}')">Connect</button>
            </div>
        `;
    } else if (type === 'flashcard') {
        const data = JSON.parse(content);
        contentDiv.innerHTML = `
            <div class="flashcard-view" onclick="flipFlashcard(event, '${nodeId}')">
                <div class="flashcard-label">Question</div>
                <div class="flashcard-side">${data.question}</div>
                <div class="flashcard-hint">Tap to flip</div>
            </div>
            <div class="node-actions">
                <button class="node-action-btn primary" onclick="switchToEditMode('${nodeId}')">Edit</button>
                <button class="node-action-btn connection-btn" onclick="toggleConnectionMode('${nodeId}')">Connect</button>
            </div>
        `;
        nodeDiv.dataset.flashcardSide = 'question';
        nodeDiv.dataset.flashcardQuestion = data.question;
        nodeDiv.dataset.flashcardAnswer = data.answer;

        // Add touch support for flashcard flip
        const flashcardView = contentDiv.querySelector('.flashcard-view');
        flashcardView.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            flipFlashcard(null, nodeId);
        }, { passive: false });
    } else if (type === 'quiz') {
        const data = JSON.parse(content);
        let optionsHTML = '';
        for (let i = 0; i < data.options.length; i++) {
            optionsHTML += `<button class="quiz-option-btn" onclick="selectQuizOption(event, '${nodeId}', ${i}, ${data.correctIndex})">${data.options[i]}</button>`;
        }
        contentDiv.innerHTML = `
            <div class="quiz-view">
                <div class="quiz-question-text">${data.question}</div>
                ${optionsHTML}
            </div>
            <div class="node-actions">
                <button class="node-action-btn primary" onclick="switchToEditMode('${nodeId}')">Edit</button>
                <button class="node-action-btn connection-btn" onclick="toggleConnectionMode('${nodeId}')">Connect</button>
            </div>
        `;

        // Add touch support for quiz buttons
        const quizButtons = contentDiv.querySelectorAll('.quiz-option-btn');
        quizButtons.forEach((btn, i) => {
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectQuizOption(null, nodeId, i, data.correctIndex);
            }, { passive: false });
        });
    }
}

// Render node in EDIT mode
function renderNodeEditMode(nodeId, type, content, contentDiv) {
    if (type === 'note') {
        const noteContent = content || '';
        contentDiv.innerHTML = `
            <textarea class="note-textarea" placeholder="Type your note here...">${noteContent}</textarea>
            <div class="node-actions">
                <button class="node-action-btn primary" onclick="saveAndSwitchToView('${nodeId}')">Save</button>
            </div>
        `;
    } else if (type === 'flashcard') {
        const data = content ? JSON.parse(content) : { question: '', answer: '' };
        contentDiv.innerHTML = `
            <label>Question:</label>
            <textarea class="flashcard-question" placeholder="Enter question...">${data.question}</textarea>
            <label>Answer:</label>
            <textarea class="flashcard-answer" placeholder="Enter answer...">${data.answer}</textarea>
            <div class="node-actions">
                <button class="node-action-btn primary" onclick="saveAndSwitchToView('${nodeId}')">Save</button>
            </div>
        `;
    } else if (type === 'quiz') {
        const data = content ? JSON.parse(content) : { question: '', options: ['', '', '', ''], correctIndex: 0 };
        let optionsHTML = '';
        for (let i = 0; i < 4; i++) {
            const checked = i === data.correctIndex ? 'checked' : '';
            optionsHTML += `
                <div class="quiz-option">
                    <input type="radio" name="correct-${nodeId}" value="${i}" ${checked} class="quiz-correct-${i}">
                    <input type="text" class="quiz-option-${i}" placeholder="Option ${i + 1}" value="${data.options[i]}">
                </div>
            `;
        }
        contentDiv.innerHTML = `
            <label>Question:</label>
            <textarea class="quiz-question" placeholder="Enter quiz question...">${data.question}</textarea>
            <label>Options (select correct answer):</label>
            ${optionsHTML}
            <div class="node-actions">
                <button class="node-action-btn primary" onclick="saveAndSwitchToView('${nodeId}')">Save</button>
            </div>
        `;
    }

    // Add auto-save listeners
    const inputs = contentDiv.querySelectorAll('textarea, input[type="text"], input[type="radio"]');
    inputs.forEach(input => {
        input.addEventListener('mousedown', (e) => e.stopPropagation());
    });
}

// Switch node to edit mode
window.switchToEditMode = function(nodeId) {
    const nodeData = nodes[nodeId];
    if (!nodeData) return;

    const nodeDiv = nodeData.element;
    const contentDiv = nodeDiv.querySelector('.node-content');
    const type = nodeData.type;

    // Get current content from database
    appwriteDatabase.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.nodesCollectionId,
        nodeId
    ).then(doc => {
        renderNodeEditMode(nodeId, type, doc.content, contentDiv);
    });
};

// Save and switch to view mode
window.saveAndSwitchToView = async function(nodeId) {
    await saveNodeContent(nodeId);

    const nodeData = nodes[nodeId];
    if (!nodeData) return;

    const nodeDiv = nodeData.element;
    const contentDiv = nodeDiv.querySelector('.node-content');
    const type = nodeData.type;

    // Get updated content from database
    const doc = await appwriteDatabase.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.nodesCollectionId,
        nodeId
    );

    renderNodeViewMode(nodeId, type, doc.content, contentDiv);
};

// Flip flashcard
window.flipFlashcard = function(event, nodeId) {
    if (event) event.stopPropagation();
    const nodeData = nodes[nodeId];
    if (!nodeData) return;

    const nodeDiv = nodeData.element;
    const currentSide = nodeDiv.dataset.flashcardSide;
    const flashcardView = nodeDiv.querySelector('.flashcard-view');
    const label = flashcardView.querySelector('.flashcard-label');
    const side = flashcardView.querySelector('.flashcard-side');

    if (currentSide === 'question') {
        label.textContent = 'Answer';
        side.textContent = nodeDiv.dataset.flashcardAnswer;
        nodeDiv.dataset.flashcardSide = 'answer';
    } else {
        label.textContent = 'Question';
        side.textContent = nodeDiv.dataset.flashcardQuestion;
        nodeDiv.dataset.flashcardSide = 'question';
    }
};

// Select quiz option
window.selectQuizOption = function(event, nodeId, selectedIndex, correctIndex) {
    if (event) event.stopPropagation();
    const nodeData = nodes[nodeId];
    if (!nodeData) return;

    const nodeDiv = nodeData.element;
    const allButtons = nodeDiv.querySelectorAll('.quiz-option-btn');
    const button = allButtons[selectedIndex];

    // Disable all buttons
    allButtons.forEach(btn => btn.classList.add('disabled'));

    // Show correct/incorrect
    if (selectedIndex === correctIndex) {
        button.classList.add('correct');
    } else {
        button.classList.add('incorrect');
        allButtons[correctIndex].classList.add('correct');
    }
}

// Save node content from editable fields
async function saveNodeContent(nodeId) {
    const nodeData = nodes[nodeId];
    if (!nodeData) return;

    const nodeDiv = nodeData.element;
    const type = nodeData.type;
    let content = '';

    if (type === 'note') {
        const textarea = nodeDiv.querySelector('.note-textarea');
        content = textarea.value;
    } else if (type === 'flashcard') {
        const question = nodeDiv.querySelector('.flashcard-question').value;
        const answer = nodeDiv.querySelector('.flashcard-answer').value;
        content = JSON.stringify({ question, answer });
    } else if (type === 'quiz') {
        const question = nodeDiv.querySelector('.quiz-question').value;
        const options = [];
        for (let i = 0; i < 4; i++) {
            options.push(nodeDiv.querySelector(`.quiz-option-${i}`).value);
        }
        const correctRadio = nodeDiv.querySelector('input[type="radio"]:checked');
        const correctIndex = correctRadio ? parseInt(correctRadio.value) : 0;
        content = JSON.stringify({ question, options, correctIndex });
    }

    try {
        await appwriteDatabase.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.nodesCollectionId,
            nodeId,
            { content }
        );
    } catch (error) {
        console.error('Error saving node content:', error);
    }
}

window.deleteNode = async function(nodeId) {
    if (!confirm('Delete this node?')) return;

    try {
        await appwriteDatabase.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.nodesCollectionId,
            nodeId
        );

        // Remove node from DOM
        if (nodes[nodeId]) {
            nodes[nodeId].element.remove();
            delete nodes[nodeId];
        }

        // Remove associated connections
        connections = connections.filter(conn => {
            if (conn.sourceId === nodeId || conn.targetId === nodeId) {
                // Delete from database
                deleteConnection(conn.id);
                return false;
            }
            return true;
        });

        updateConnectionLines();
    } catch (error) {
        console.error('Error deleting node:', error);
    }
};

async function updateNodePosition(nodeId, x, y) {
    try {
        await appwriteDatabase.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.nodesCollectionId,
            nodeId,
            { x, y }
        );

        if (nodes[nodeId]) {
            nodes[nodeId].x = x;
            nodes[nodeId].y = y;
        }
    } catch (error) {
        console.error('Error updating node position:', error);
    }
}

// ===========================
// CONNECTION MANAGEMENT
// ===========================
window.toggleConnectionMode = function(nodeId) {
    if (!connectionStartNode) {
        // Start connection mode
        connectionStartNode = nodeId;
        if (nodes[nodeId]) {
            nodes[nodeId].element.classList.add('connection-mode-active');
        }

        // Show notification
        const nodeDiv = nodes[nodeId].element;
        const contentDiv = nodeDiv.querySelector('.node-content');
        const existingHint = contentDiv.querySelector('.connection-hint');
        if (!existingHint) {
            const hint = document.createElement('div');
            hint.className = 'node-save-hint connection-hint';
            hint.textContent = '🔗 Click "Connect" on another node to link them';
            hint.style.color = '#8b5cf6';
            hint.style.fontWeight = '600';
            contentDiv.appendChild(hint);
        }
    } else {
        if (connectionStartNode !== nodeId) {
            // Create connection between nodes
            createConnection(connectionStartNode, nodeId);
        }

        // Reset connection mode
        if (nodes[connectionStartNode]) {
            nodes[connectionStartNode].element.classList.remove('connection-mode-active');
            const hint = nodes[connectionStartNode].element.querySelector('.connection-hint');
            if (hint) hint.remove();
        }
        connectionStartNode = null;
    }
};

async function createConnection(sourceId, targetId) {
    try {
        // Check if connection already exists
        const exists = connections.find(c =>
            (c.sourceId === sourceId && c.targetId === targetId) ||
            (c.sourceId === targetId && c.targetId === sourceId)
        );

        if (exists) {
            alert('Connection already exists');
            return;
        }

        const connectionData = {
            sourceId: sourceId,
            targetId: targetId,
            roomCode: currentRoom,
            timestamp: new Date().toISOString()
        };

        const newConnection = await appwriteDatabase.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.connectionsCollectionId,
            'unique()',
            connectionData
        );

        connections.push({
            id: newConnection.$id,
            sourceId: sourceId,
            targetId: targetId
        });

        updateConnectionLines();
    } catch (error) {
        console.error('Error creating connection:', error);
        alert('Error creating connection: ' + error.message);
    }
}

async function deleteConnection(connectionId) {
    try {
        await appwriteDatabase.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.connectionsCollectionId,
            connectionId
        );
    } catch (error) {
        console.error('Error deleting connection:', error);
    }
}

function updateConnectionLines() {
    const svg = document.getElementById('connection-svg');
    svg.innerHTML = '';

    connections.forEach(conn => {
        const sourceNode = nodes[conn.sourceId];
        const targetNode = nodes[conn.targetId];

        if (sourceNode && targetNode) {
            const sourceEl = sourceNode.element;
            const targetEl = targetNode.element;

            const sourceRect = sourceEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const svgRect = svg.getBoundingClientRect();

            const x1 = (sourceRect.left + sourceRect.width / 2 - svgRect.left - canvasOffsetX) / canvasScale;
            const y1 = (sourceRect.top + sourceRect.height / 2 - svgRect.top - canvasOffsetY) / canvasScale;
            const x2 = (targetRect.left + targetRect.width / 2 - svgRect.left - canvasOffsetX) / canvasScale;
            const y2 = (targetRect.top + targetRect.height / 2 - svgRect.top - canvasOffsetY) / canvasScale;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('class', 'connection-line');

            svg.appendChild(line);
        }
    });
}

// ===========================
// CHAT MANAGEMENT
// ===========================
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    try {
        await appwriteDatabase.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.messagesCollectionId,
            'unique()',
            {
                sender: username,
                text: message,
                roomCode: currentRoom,
                timestamp: new Date().toISOString()
            }
        );

        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message: ' + error.message);
    }
}

function renderChatMessage(messageDoc) {
    const messagesContainer = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';

    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = messageDoc.sender === username ? 'You' : messageDoc.sender;

    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    textDiv.textContent = messageDoc.text;

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    const date = new Date(messageDoc.timestamp);
    timestampDiv.textContent = date.toLocaleTimeString();

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timestampDiv);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ===========================
// DATA LOADING
// ===========================
async function loadNodes() {
    try {
        const { Query } = window.Appwrite;
        const response = await appwriteDatabase.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.nodesCollectionId,
            [Query.equal('roomCode', currentRoom)]
        );

        response.documents.forEach(nodeDoc => {
            renderNode(nodeDoc);
        });
    } catch (error) {
        console.error('Error loading nodes:', error);
    }
}

async function loadConnections() {
    try {
        const { Query } = window.Appwrite;
        const response = await appwriteDatabase.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.connectionsCollectionId,
            [Query.equal('roomCode', currentRoom)]
        );

        connections = response.documents.map(doc => ({
            id: doc.$id,
            sourceId: doc.sourceId,
            targetId: doc.targetId
        }));

        updateConnectionLines();
    } catch (error) {
        console.error('Error loading connections:', error);
    }
}

async function loadChatMessages() {
    try {
        const { Query } = window.Appwrite;
        const response = await appwriteDatabase.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.messagesCollectionId,
            [
                Query.equal('roomCode', currentRoom),
                Query.orderAsc('timestamp'),
                Query.limit(50)
            ]
        );

        response.documents.forEach(messageDoc => {
            renderChatMessage(messageDoc);
        });
    } catch (error) {
        console.error('Error loading chat messages:', error);
    }
}

// ===========================
// REALTIME UPDATES
// ===========================
function subscribeToRealtimeUpdates() {
    // Subscribe to nodes collection
    appwriteClient.subscribe(
        `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.nodesCollectionId}.documents`,
        (response) => {
            const event = response.events[0];
            const payload = response.payload;

            if (payload.roomCode !== currentRoom) return;

            if (event.includes('create')) {
                // Only render if we don't already have this node
                if (!nodes[payload.$id]) {
                    renderNode(payload);
                }
            } else if (event.includes('update')) {
                if (nodes[payload.$id]) {
                    const nodeData = nodes[payload.$id];
                    const nodeDiv = nodeData.element;
                    const contentDiv = nodeDiv.querySelector('.node-content');

                    // Check if we're currently in edit mode
                    const isInEditMode = contentDiv.querySelector('textarea, input[type="text"]') !== null;

                    // Update position if changed
                    if (nodeData.x !== payload.x || nodeData.y !== payload.y) {
                        nodeData.element.style.left = payload.x + 'px';
                        nodeData.element.style.top = payload.y + 'px';
                        nodeData.x = payload.x;
                        nodeData.y = payload.y;
                        updateConnectionLines();
                    }

                    // Update content if changed and not currently editing
                    if (!isInEditMode) {
                        // Re-render the node to show updated content
                        renderNodeViewMode(payload.$id, payload.type, payload.content, contentDiv);
                    }
                } else {
                    // Node doesn't exist locally, render it
                    renderNode(payload);
                }
            } else if (event.includes('delete')) {
                if (nodes[payload.$id]) {
                    nodes[payload.$id].element.remove();
                    delete nodes[payload.$id];
                }
                updateConnectionLines();
            }
        }
    );

    // Subscribe to connections collection
    appwriteClient.subscribe(
        `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.connectionsCollectionId}.documents`,
        (response) => {
            const event = response.events[0];
            const payload = response.payload;

            if (payload.roomCode !== currentRoom) return;

            if (event.includes('create')) {
                const exists = connections.find(c => c.id === payload.$id);
                if (!exists) {
                    connections.push({
                        id: payload.$id,
                        sourceId: payload.sourceId,
                        targetId: payload.targetId
                    });
                    updateConnectionLines();
                }
            } else if (event.includes('delete')) {
                connections = connections.filter(c => c.id !== payload.$id);
                updateConnectionLines();
            }
        }
    );

    // Subscribe to messages collection
    appwriteClient.subscribe(
        `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.messagesCollectionId}.documents`,
        (response) => {
            const event = response.events[0];
            const payload = response.payload;

            if (payload.roomCode !== currentRoom) return;

            if (event.includes('create')) {
                renderChatMessage(payload);
            }
        }
    );

    console.log('Subscribed to realtime updates');
}

// Update connection lines on window resize
window.addEventListener('resize', () => {
    updateConnectionLines();
});
