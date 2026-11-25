/* Vigilia — forum local basé sur localStorage */
const STORAGE_KEY = 'vigilia-data-v1';

const seed = {
  users: [],
  categories: [
    { id: 'general', name: 'Général' },
    { id: 'tech', name: 'Tech' },
    { id: 'culture', name: 'Culture' }
  ],
  topics: [],
  replies: []
};

let data = loadData();
let currentUser = null;
let selectedCategory = null;
let selectedTopic = null;
let authMode = 'login';
let editing = null;

const $ = (selector) => document.querySelector(selector);

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seed);
  } catch {
    return structuredClone(seed);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderCategories() {
  $('#categories').innerHTML = `
    <button class="category-button ${selectedCategory ? '' : 'active'}" data-category="">Toutes</button>
    ${data.categories.map(category => `
      <button class="category-button ${selectedCategory === category.id ? 'active' : ''}" data-category="${category.id}">
        ${escapeHtml(category.name)}
      </button>`).join('')}`;

  $('#topic-category').innerHTML = data.categories.map(category =>
    `<option value="${category.id}">${escapeHtml(category.name)}</option>`
  ).join('');
}

function renderTopics() {
  selectedTopic = null;
  $('#topic-view').hidden = true;
  $('#topic-list').hidden = false;
  $('#view-title').textContent = selectedCategory
    ? data.categories.find(c => c.id === selectedCategory)?.name || 'Sujets'
    : 'Tous les sujets';

  const query = $('#search').value.trim().toLowerCase();
  const topics = data.topics
    .filter(topic => !selectedCategory || topic.categoryId === selectedCategory)
    .filter(topic => !query || topic.title.toLowerCase().includes(query))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  $('#topic-list').innerHTML = topics.length ? topics.map(topic => `
    <article class="topic-card">
      <button data-topic="${topic.id}">
        <h3>${escapeHtml(topic.title)}</h3>
        <p>${escapeHtml(topic.author)} · ${topicReplies(topic.id).length} réponse(s)</p>
      </button>
    </article>`).join('') : '<p class="muted">Aucun sujet trouvé.</p>';
}

function topicReplies(topicId) {
  return data.replies.filter(reply => reply.topicId === topicId);
}

function canManage(message) {
  return currentUser && (currentUser.username === message.author || currentUser.isAdmin);
}

function openTopic(topicId) {
  selectedTopic = data.topics.find(topic => topic.id === topicId);
  if (!selectedTopic) return;

  $('#topic-list').hidden = true;
  $('#topic-view').hidden = false;
  $('#view-title').textContent = selectedTopic.title;

  const replies = topicReplies(topicId).sort((a, b) => a.createdAt - b.createdAt);
  const original = `
    <article class="post">
      <div class="post-meta"><strong>${escapeHtml(selectedTopic.author)}</strong><span>${formatDate(selectedTopic.createdAt)}</span></div>
      <p class="post-content">${escapeHtml(selectedTopic.content)}</p>
      ${canManage(selectedTopic) ? manageButtons(selectedTopic, 'topic') : ''}
    </article>`;

  $('#topic-view').innerHTML = original + replies.map(reply => `
    <article class="post">
      <div class="post-meta"><strong>${escapeHtml(reply.author)}</strong><span>${formatDate(reply.createdAt)}</span></div>
      <p class="post-content">${escapeHtml(reply.content)}</p>
      ${canManage(reply) ? manageButtons(reply, 'reply') : ''}
    </article>`).join('') + `
    <form class="reply-box" id="reply-form">
      <textarea id="reply-content" placeholder="${currentUser ? 'Ajouter une réponse…' : 'Connectez-vous pour répondre…'}" ${currentUser ? '' : 'disabled'} maxlength="5000"></textarea>
      ${currentUser ? '<button class="button" type="submit">Répondre</button>' : ''}
    </form>`;
}

function manageButtons(message, type) {
  return `<div class="post-actions">
    ${type === 'topic' || !message.isAdminOnly ? `<button class="button ghost edit-button" data-type="${type}" data-id="${message.id}">Modifier</button>` : ''}
    <button class="button danger delete-button" data-type="${type}" data-id="${message.id}">Supprimer</button>
  </div>`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

function setAuthMode(mode) {
  authMode = mode;
  $('#auth-title').textContent = mode === 'login' ? 'Connexion' : 'Inscription';
  $('#auth-submit').textContent = mode === 'login' ? 'Se connecter' : 'Créer mon compte';
  $('#auth-switch').textContent = mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte';
  $('#auth-error').textContent = '';
}

function updateAuthButton() {
  $('#auth-button').textContent = currentUser
    ? `${currentUser.username} · Déconnexion`
    : 'Connexion';
  $('#new-topic-button').hidden = !currentUser;
}

$('#auth-button').addEventListener('click', () => {
  if (currentUser) {
    currentUser = null;
    updateAuthButton();
    if (selectedTopic) openTopic(selectedTopic.id); else renderTopics();
  } else {
    setAuthMode('login');
    $('#auth-dialog').showModal();
  }
});

$('#auth-switch').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));

$('#auth-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const username = String(form.get('username')).trim();
  const password = String(form.get('password'));
  $('#auth-error').textContent = '';

  if (authMode === 'register') {
    if (!username || password.length < 4) {
      $('#auth-error').textContent = 'Pseudo requis et mot de passe d’au moins 4 caractères.';
      return;
    }
    if (data.users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
      $('#auth-error').textContent = 'Ce pseudo est déjà utilisé.';
      return;
    }
    const user = { id: uid('user'), username, password, isAdmin: username.toLowerCase() === 'admin' };
    data.users.push(user);
    saveData();
    currentUser = user;
  } else {
    const user = data.users.find(item => item.username === username && item.password === password);
    if (!user) {
      $('#auth-error').textContent = 'Pseudo ou mot de passe incorrect.';
      return;
    }
    currentUser = user;
  }

  event.currentTarget.reset();
  $('#auth-dialog').close();
  updateAuthButton();
  if (selectedTopic) openTopic(selectedTopic.id); else renderTopics();
});

$('#new-topic-button').addEventListener('click', () => {
  editing = null;
  $('#topic-dialog-title').textContent = 'Nouveau sujet';
  $('#topic-form').reset();
  $('#topic-dialog').showModal();
});

$('#topic-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const title = String(form.get('title')).trim();
  const content = String(form.get('content')).trim();
  if (!title || !content) return;

  if (editing?.type === 'topic') {
    editing.message.title = title;
    editing.message.content = content;
    editing.message.categoryId = String(form.get('categoryId'));
    editing.message.updatedAt = Date.now();
  } else {
    const topic = {
      id: uid('topic'), title, content,
      categoryId: String(form.get('categoryId')),
      author: currentUser.username,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    data.topics.push(topic);
  }
  saveData();
  event.currentTarget.reset();
  $('#topic-dialog').close();
  renderTopics();
});

$('#categories').addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  selectedCategory = button.dataset.category || null;
  renderCategories();
  renderTopics();
});

$('#search').addEventListener('input', renderTopics);
$('#topic-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-topic]');
  if (button) openTopic(button.dataset.topic);
});

$('#brand-link').addEventListener('click', (event) => {
  event.preventDefault();
  selectedCategory = null;
  $('#search').value = '';
  renderCategories();
  renderTopics();
});

$('#topic-view').addEventListener('submit', (event) => {
  if (event.target.id !== 'reply-form') return;
  event.preventDefault();
  const content = $('#reply-content').value.trim();
  if (!content || !currentUser) return;
  data.replies.push({
    id: uid('reply'), topicId: selectedTopic.id,
    content, author: currentUser.username, createdAt: Date.now()
  });
  selectedTopic.updatedAt = Date.now();
  saveData();
  openTopic(selectedTopic.id);
});

$('#topic-view').addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.delete-button');
  const editButton = event.target.closest('.edit-button');

  if (deleteButton) {
    const { type, id } = deleteButton.dataset;
    const collection = type === 'topic' ? data.topics : data.replies;
    const message = collection.find(item => item.id === id);
    if (!message || !canManage(message)) return;
    if (!confirm('Supprimer définitivement ce message ?')) return;

    if (type === 'topic') {
      data.replies = data.replies.filter(reply => reply.topicId !== id);
      data.topics = data.topics.filter(topic => topic.id !== id);
      saveData();
      renderTopics();
    } else {
      data.replies = data.replies.filter(reply => reply.id !== id);
      saveData();
      openTopic(selectedTopic.id);
    }
  }

  if (editButton) {
    const { type, id } = editButton.dataset;
    if (type === 'reply') {
      const reply = data.replies.find(item => item.id === id);
      if (!reply || !canManage(reply)) return;
      const content = prompt('Modifier la réponse', reply.content);
      if (content?.trim()) {
        reply.content = content.trim();
        saveData();
        openTopic(selectedTopic.id);
      }
    } else {
      const topic = data.topics.find(item => item.id === id);
      if (!topic || !canManage(topic)) return;
      editing = { type, message: topic };
      $('#topic-dialog-title').textContent = 'Modifier le sujet';
      $('#topic-form [name="title"]').value = topic.title;
      $('#topic-form [name="categoryId"]').value = topic.categoryId;
      $('#topic-form [name="content"]').value = topic.content;
      $('#topic-dialog').showModal();
    }
  }
});

renderCategories();
renderTopics();
updateAuthButton();
