import React, { useState, useEffect } from 'react';
import { getCategoriesAPI, createCategoryAPI, updateCategoryAPI, deleteCategoryAPI } from '../services/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', icon: '', description: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await getCategoriesAPI();
      setCategories(res.data.categories);
    } catch (err) {
      alert('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentCategory) {
        await updateCategoryAPI(currentCategory._id, formData);
      } else {
        await createCategoryAPI(formData);
      }
      setShowModal(false);
      setFormData({ name: '', icon: '', description: '' });
      setCurrentCategory(null);
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteCategoryAPI(id);
        fetchCategories();
      } catch (err) {
        alert('Delete failed');
      }
    }
  };

  const openEdit = (cat) => {
    setCurrentCategory(cat);
    setFormData({ name: cat.name, icon: cat.icon, description: cat.description });
    setShowModal(true);
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading categories...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Shop Categories</h2>
        <button style={styles.addButton} onClick={() => { setShowModal(true); setCurrentCategory(null); setFormData({ name: '', icon: '', description: '' }); }}>
          + Add Category
        </button>
      </div>

      <div style={styles.grid}>
        {categories.map(cat => (
          <div key={cat._id} style={styles.card}>
            <div style={styles.iconBox}>
              <span style={{ fontSize: '24px' }}>{cat.icon || '📁'}</span>
            </div>
            <div style={styles.cardContent}>
              <h3 style={styles.catName}>{cat.name}</h3>
              <p style={styles.catSlug}>slug: {cat.slug}</p>
              <p style={styles.catDesc}>{cat.description || 'No description'}</p>
              <div style={styles.actions}>
                <button style={styles.editBtn} onClick={() => openEdit(cat)}>Edit</button>
                <button style={styles.deleteBtn} onClick={() => handleDelete(cat._id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>{currentCategory ? 'Edit Category' : 'Add New Category'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label>Category Name</label>
                <input 
                  style={styles.input} 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div style={styles.formGroup}>
                <label>Icon Name (e.g., 'scissors', 'utensils')</label>
                <input 
                  style={styles.input} 
                  value={formData.icon} 
                  onChange={(e) => setFormData({...formData, icon: e.target.value})} 
                />
              </div>
              <div style={styles.formGroup}>
                <label>Description</label>
                <textarea 
                  style={{...styles.input, height: '80px'}} 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                />
              </div>
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" style={styles.saveBtn}>Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '40px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  addButton: { padding: '10px 20px', backgroundColor: '#6C63FF', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', gap: '15px' },
  iconBox: { width: '50px', height: '50px', backgroundColor: '#F0EFFF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  catName: { margin: '0 0 5px 0', fontSize: '18px' },
  catSlug: { margin: '0 0 10px 0', fontSize: '12px', color: '#888', fontStyle: 'italic' },
  catDesc: { margin: '0 0 15px 0', fontSize: '14px', color: '#666' },
  actions: { display: 'flex', gap: '10px' },
  editBtn: { border: 'none', background: 'none', color: '#6C63FF', cursor: 'pointer', fontWeight: 'bold', padding: 0 },
  deleteBtn: { border: 'none', background: 'none', color: '#FF4D4D', cursor: 'pointer', fontWeight: 'bold', padding: 0 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#fff', padding: '30px', borderRadius: '16px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
  formGroup: { marginBottom: '20px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #DDD', marginTop: '5px', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '25px' },
  cancelBtn: { padding: '10px 20px', border: 'none', background: 'none', color: '#888', cursor: 'pointer' },
  saveBtn: { padding: '10px 20px', backgroundColor: '#6C63FF', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }
};
