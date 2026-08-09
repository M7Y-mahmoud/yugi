import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, onValue, push, set, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db } from "./firebase-config.js";
import { logActivity, initActivityLogs } from "./activity-log.js";

const profileDetails = document.getElementById('profile-details');
const adminCardsContainer = document.getElementById('admin-cards-container');
const adminSearchInput = document.getElementById('admin-search-input');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statMonster = document.getElementById('stat-monster');
const statSpell = document.getElementById('stat-spell');
const statTrap = document.getElementById('stat-trap');

// Modal Elements
const openAddModalBtn = document.getElementById('open-add-modal-btn');
const cardModal = document.getElementById('card-modal');
const closeCardModalBtn = document.getElementById('close-card-modal-btn');
const cardModalTitle = document.getElementById('card-modal-title');
const cardForm = document.getElementById('card-form');
const monsterFields = document.getElementById('monster-fields');
const cardTypeInput = document.getElementById('card-type');
const saveCardBtn = document.getElementById('save-card-btn');

// Delete Modal
const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

let allCards = [];
let deleteTargetId = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loadAdminProfile(user);
    initDashboard();
  }
});

async function loadAdminProfile(user) {
  try {
    const adminRef = ref(db, `admins/${user.uid}`);
    const snapshot = await get(adminRef);
    
    if (snapshot.exists()) {
      const adminData = snapshot.val();
      
      const joinedDate = adminData.createdAt ? new Date(adminData.createdAt).toLocaleDateString('ar-EG') : 'غير متوفر';
      const roleText = adminData.role === 'superadmin' ? 'مدير عام (Superadmin)' : 'مدير (Admin)';
      
      profileDetails.innerHTML = `
        <p><strong>الاسم:</strong> ${adminData.name || 'غير متوفر'}</p>
        <p><strong>البريد:</strong> <span class="english-text">${adminData.email || user.email}</span></p>
        <p><strong>الدور:</strong> ${roleText}</p>
        <p><strong>تاريخ الانضمام:</strong> ${joinedDate}</p>
      `;
      
      initActivityLogs(adminData.role, user.uid);
    } else {
      alert('غير مصرح لك بالدخول إلى هذه الصفحة.');
      window.location.replace('../index.html');
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    profileDetails.innerHTML = '<p class="error-msg">حدث خطأ أثناء تحميل البيانات.</p>';
  }
}

function initDashboard() {
  const cardsRef = ref(db, 'cards');
  onValue(cardsRef, (snapshot) => {
    const data = snapshot.val();
    allCards = [];
    let monsterCount = 0;
    let spellCount = 0;
    let trapCount = 0;

    if (data) {
      Object.keys(data).forEach(key => {
        const card = { id: key, ...data[key] };
        allCards.push(card);
        if (card.type === 'Monster') monsterCount++;
        else if (card.type === 'Spell') spellCount++;
        else if (card.type === 'Trap') trapCount++;
      });
    }

    statTotal.textContent = allCards.length;
    statMonster.textContent = monsterCount;
    statSpell.textContent = spellCount;
    statTrap.textContent = trapCount;

    filterAndRenderCards();
  });

  adminSearchInput.addEventListener('input', filterAndRenderCards);
  
  cardTypeInput.addEventListener('change', () => {
    if (cardTypeInput.value === 'Monster') {
      monsterFields.style.display = 'block';
    } else {
      monsterFields.style.display = 'none';
    }
  });

  openAddModalBtn.addEventListener('click', () => openCardModal());
  closeCardModalBtn.addEventListener('click', () => cardModal.style.display = 'none');
  cancelDeleteBtn.addEventListener('click', () => deleteModal.style.display = 'none');
  
  cardForm.addEventListener('submit', handleCardSubmit);
  confirmDeleteBtn.addEventListener('click', executeDelete);
  
  const autoFetchBtn = document.getElementById('auto-fetch-btn');
  if (autoFetchBtn) {
    autoFetchBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('card-name');
      const name = nameInput.value.trim();
      if (!name) {
        alert('الرجاء إدخال اسم الكارت بالإنجليزية أولاً');
        return;
      }
      
      autoFetchBtn.disabled = true;
      autoFetchBtn.textContent = 'جاري...';
      
      try {
        const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`);
        if (!response.ok) throw new Error('Card not found');
        const data = await response.json();
        const cardData = data.data[0];
        
        document.getElementById('card-image').value = cardData.card_images[0].image_url;
        document.getElementById('card-description').value = cardData.desc;
        
        if (cardData.type.includes('Monster')) {
          document.getElementById('card-type').value = 'Monster';
          monsterFields.style.display = 'block';
          document.getElementById('card-attribute').value = cardData.attribute || '';
          document.getElementById('card-level').value = cardData.level || '';
          document.getElementById('card-atk').value = cardData.atk !== undefined ? cardData.atk : '';
          document.getElementById('card-def').value = cardData.def !== undefined ? cardData.def : '';
        } else if (cardData.type.includes('Spell')) {
          document.getElementById('card-type').value = 'Spell';
          monsterFields.style.display = 'none';
        } else if (cardData.type.includes('Trap')) {
          document.getElementById('card-type').value = 'Trap';
          monsterFields.style.display = 'none';
        }
      } catch (error) {
        console.error('Fetch error:', error);
        alert('لم يتم العثور على الكارت، تأكد من صحة الاسم (بالإنجليزية).');
      } finally {
        autoFetchBtn.disabled = false;
        autoFetchBtn.textContent = 'جلب البيانات';
      }
    });
  }
}

function filterAndRenderCards() {
  const searchTerm = adminSearchInput.value.toLowerCase();
  const filtered = allCards.filter(card => 
    card.name && card.name.toLowerCase().includes(searchTerm)
  );

  adminCardsContainer.innerHTML = '';
  
  if (filtered.length === 0) {
    adminCardsContainer.innerHTML = '<p class="empty-state">لا توجد كروت.</p>';
    return;
  }

  filtered.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'admin-card-item';
    
    let typeClass = '';
    if (card.type === 'Monster') typeClass = 'type-monster';
    else if (card.type === 'Spell') typeClass = 'type-spell';
    else if (card.type === 'Trap') typeClass = 'type-trap';

    cardEl.innerHTML = `
      <img src="${card.imageUrl || 'https://via.placeholder.com/220x320?text=No+Image'}" alt="${card.name}" loading="lazy">
      <h3 class="english-text">${card.name}</h3>
      <span class="card-type ${typeClass}">${card.type}</span>
      <div class="admin-card-actions">
        <button class="edit-btn">تعديل</button>
        <button class="delete-btn">حذف</button>
      </div>
    `;

    cardEl.querySelector('.edit-btn').addEventListener('click', () => openCardModal(card));
    cardEl.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(card.id));

    adminCardsContainer.appendChild(cardEl);
  });
}

function openCardModal(card = null) {
  cardForm.reset();
  if (card) {
    cardModalTitle.textContent = 'تعديل كارت';
    document.getElementById('card-id').value = card.id;
    document.getElementById('card-name').value = card.name;
    document.getElementById('card-image').value = card.imageUrl;
    document.getElementById('card-type').value = card.type;
    document.getElementById('card-description').value = card.description;
    
    if (card.type === 'Monster') {
      monsterFields.style.display = 'block';
      document.getElementById('card-attribute').value = card.attribute || '';
      document.getElementById('card-level').value = card.level || '';
      document.getElementById('card-atk').value = card.atk || '';
      document.getElementById('card-def').value = card.def || '';
    } else {
      monsterFields.style.display = 'none';
    }
  } else {
    cardModalTitle.textContent = 'إضافة كارت جديد';
    document.getElementById('card-id').value = '';
    monsterFields.style.display = 'block';
  }
  
  cardModal.style.display = 'flex';
}

async function handleCardSubmit(e) {
  e.preventDefault();
  
  saveCardBtn.disabled = true;
  saveCardBtn.textContent = 'جاري الحفظ...';

  const cardId = document.getElementById('card-id').value;
  const cardData = {
    name: document.getElementById('card-name').value.trim(),
    imageUrl: document.getElementById('card-image').value.trim(),
    type: document.getElementById('card-type').value,
    description: document.getElementById('card-description').value.trim(),
    updatedAt: serverTimestamp()
  };

  if (cardData.type === 'Monster') {
    cardData.attribute = document.getElementById('card-attribute').value;
    cardData.level = parseInt(document.getElementById('card-level').value) || null;
    cardData.atk = parseInt(document.getElementById('card-atk').value) || 0;
    cardData.def = parseInt(document.getElementById('card-def').value) || 0;
  }

  try {
    if (cardId) {
      // Edit
      const cardRef = ref(db, `cards/${cardId}`);
      await set(cardRef, { ...allCards.find(c => c.id === cardId), ...cardData });
      await logActivity('edit_card', cardId, `تم تعديل كارت: ${cardData.name}`);
    } else {
      // Add
      cardData.createdAt = serverTimestamp();
      cardData.addedBy = auth.currentUser.uid;
      const newCardRef = push(ref(db, 'cards'));
      await set(newCardRef, cardData);
      await logActivity('add_card', newCardRef.key, `تمت إضافة كارت جديد: ${cardData.name}`);
    }
    
    cardModal.style.display = 'none';
  } catch (error) {
    console.error("Error saving card:", error);
    alert('حدث خطأ أثناء الحفظ.');
  } finally {
    saveCardBtn.disabled = false;
    saveCardBtn.textContent = 'حفظ الكارت';
  }
}

function openDeleteModal(id) {
  deleteTargetId = id;
  deleteModal.style.display = 'flex';
}

async function executeDelete() {
  if (!deleteTargetId) return;
  
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'جاري الحذف...';
  
  try {
    const cardToDelete = allCards.find(c => c.id === deleteTargetId);
    await remove(ref(db, `cards/${deleteTargetId}`));
    await logActivity('delete_card', deleteTargetId, `تم حذف كارت: ${cardToDelete?.name || 'غير معروف'}`);
    deleteModal.style.display = 'none';
  } catch (error) {
    console.error("Error deleting card:", error);
    alert('حدث خطأ أثناء الحذف.');
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'حذف';
    deleteTargetId = null;
  }
}


// Bulk Add logic
const openBulkAddModalBtn = document.getElementById('open-bulk-add-modal-btn');
const bulkAddModal = document.getElementById('bulk-add-modal');
const closeBulkModalBtn = document.getElementById('close-bulk-modal-btn');
const bulkAddForm = document.getElementById('bulk-add-form');
const bulkCardNamesInput = document.getElementById('bulk-card-names');
const bulkAddProgress = document.getElementById('bulk-add-progress');
const bulkCurrentProgress = document.getElementById('bulk-current-progress');
const bulkTotalProgress = document.getElementById('bulk-total-progress');
const bulkErrorLog = document.getElementById('bulk-error-log');
const startBulkAddBtn = document.getElementById('start-bulk-add-btn');

if (openBulkAddModalBtn) {
  openBulkAddModalBtn.addEventListener('click', () => {
    bulkAddForm.reset();
    bulkAddProgress.style.display = 'none';
    bulkErrorLog.textContent = '';
    bulkAddModal.style.display = 'flex';
  });
}

if (closeBulkModalBtn) {
  closeBulkModalBtn.addEventListener('click', () => {
    if (startBulkAddBtn.disabled) return; // Prevent closing while processing
    bulkAddModal.style.display = 'none';
  });
}

if (bulkAddForm) {
  bulkAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const namesText = bulkCardNamesInput.value;
    const names = namesText.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    
    if (names.length === 0) {
      alert('الرجاء إدخال اسم كارت واحد على الأقل.');
      return;
    }
    
    startBulkAddBtn.disabled = true;
    startBulkAddBtn.textContent = 'جاري الإضافة...';
    bulkCardNamesInput.disabled = true;
    
    bulkTotalProgress.textContent = names.length;
    bulkCurrentProgress.textContent = '0';
    bulkErrorLog.textContent = '';
    bulkAddProgress.style.display = 'block';
    
    let successCount = 0;
    
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      try {
        const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`);
        if (!response.ok) throw new Error('Not found');
        
        const data = await response.json();
        const cardData = data.data[0];
        
        const newCard = {
          name: cardData.name,
          imageUrl: cardData.card_images[0].image_url,
          description: cardData.desc,
          createdAt: serverTimestamp(),
          addedBy: auth.currentUser.uid,
          updatedAt: serverTimestamp()
        };
        
        if (cardData.type.includes('Monster')) {
          newCard.type = 'Monster';
          newCard.attribute = cardData.attribute || '';
          newCard.level = cardData.level || null;
          newCard.atk = cardData.atk !== undefined ? cardData.atk : 0;
          newCard.def = cardData.def !== undefined ? cardData.def : 0;
        } else if (cardData.type.includes('Spell')) {
          newCard.type = 'Spell';
        } else if (cardData.type.includes('Trap')) {
          newCard.type = 'Trap';
        } else {
          newCard.type = 'Monster'; // fallback
        }
        
        const newCardRef = push(ref(db, 'cards'));
        await set(newCardRef, newCard);
        await logActivity('add_card', newCardRef.key, `تمت إضافة كارت جديد: ${newCard.name} (متعدد)`);
        
        successCount++;
      } catch (error) {
        console.error('Failed to add:', name, error);
        bulkErrorLog.textContent += `\nفشل إضافة: ${name}`;
      }
      
      bulkCurrentProgress.textContent = (i + 1).toString();
    }
    
    startBulkAddBtn.disabled = false;
    startBulkAddBtn.textContent = 'بدء الإضافة';
    bulkCardNamesInput.disabled = false;
    
    if (successCount === names.length) {
      alert('تمت إضافة جميع الكروت بنجاح!');
      bulkAddModal.style.display = 'none';
    } else {
      alert(`تمت إضافة ${successCount} من أصل ${names.length} كارت.`);
    }
  });
}
