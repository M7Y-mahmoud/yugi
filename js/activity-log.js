import { ref, push, serverTimestamp, onValue, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db, auth } from "./firebase-config.js";

export async function logActivity(action, targetCardId = null, details = "") {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const logsRef = ref(db, 'activityLogs');
    await push(logsRef, {
      adminId: user.uid,
      adminName: user.displayName || user.email,
      action: action,
      targetCardId: targetCardId,
      details: details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export function initActivityLogs(userRole, currentUserId) {
  const logsContainer = document.getElementById('logs-container');
  const actionFilter = document.getElementById('log-action-filter');
  const adminFilter = document.getElementById('log-admin-filter');
  
  if (!logsContainer) return; // Not on dashboard
  
  let allLogs = [];
  
  if (userRole === 'superadmin' && adminFilter) {
    adminFilter.style.display = 'block';
  }
  
  const logsRef = query(ref(db, 'activityLogs'));
  onValue(logsRef, (snapshot) => {
    const data = snapshot.val();
    allLogs = [];
    const adminsSet = new Set();
    
    if (data) {
      Object.keys(data).forEach(key => {
        const log = { id: key, ...data[key] };
        allLogs.push(log);
        if (log.adminName && log.adminId) {
          adminsSet.add(JSON.stringify({ id: log.adminId, name: log.adminName }));
        }
      });
      // Sort by timestamp descending
      allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    
    // Update admin filter options if superadmin
    if (userRole === 'superadmin') {
      const currentSelected = adminFilter.value;
      adminFilter.innerHTML = '<option value="">كل المديرين</option>';
      adminsSet.forEach(adminStr => {
        const admin = JSON.parse(adminStr);
        const option = document.createElement('option');
        option.value = admin.id;
        option.textContent = admin.name;
        if (admin.id === currentSelected) option.selected = true;
        adminFilter.appendChild(option);
      });
    }
    
    renderLogs();
  });
  
  function renderLogs() {
    const actionVal = actionFilter.value;
    const adminVal = userRole === 'superadmin' ? adminFilter.value : currentUserId;
    
    const filtered = allLogs.filter(log => {
      if (actionVal && log.action !== actionVal) return false;
      if (adminVal && log.adminId !== adminVal) return false;
      return true;
    });
    
    logsContainer.innerHTML = '';
    
    if (filtered.length === 0) {
      logsContainer.innerHTML = '<p class="empty-state">لا توجد نشاطات مسجلة.</p>';
      return;
    }
    
    filtered.forEach(log => {
      const el = document.createElement('div');
      el.className = `log-item ${log.action}`;
      
      let actionText = log.action;
      if (log.action === 'login') actionText = 'تسجيل دخول';
      if (log.action === 'add_card') actionText = 'إضافة كارت';
      if (log.action === 'edit_card') actionText = 'تعديل كارت';
      if (log.action === 'delete_card') actionText = 'حذف كارت';
      
      const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString('ar-EG') : 'غير متوفر';
      
      el.innerHTML = `
        <div class="log-header">
          <span><strong>${log.adminName}</strong> - ${actionText}</span>
          <span>${dateStr}</span>
        </div>
        <div class="log-details">${log.details}</div>
      `;
      logsContainer.appendChild(el);
    });
  }
  
  actionFilter.addEventListener('change', renderLogs);
  if (userRole === 'superadmin') {
    adminFilter.addEventListener('change', renderLogs);
  }
}
