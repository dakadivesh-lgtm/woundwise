import React, { useState, useEffect } from 'react';
import { supportService } from '../services/supportService';

export default function HelpPage({ user, onShowNotification }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState('Technical Issue');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('Normal');

  const [submitting, setSubmitting] = useState(false);
  const [submittedTickets, setSubmittedTickets] = useState([]);

  useEffect(() => {
    loadUserTickets();
  }, []);

  const loadUserTickets = async () => {
    try {
      const tickets = await supportService.getMyTickets();
      setSubmittedTickets(tickets || []);
    } catch (err) {
      console.warn('Could not load tickets:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      onShowNotification('Please fill in all required fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await supportService.submitTicket({
        name,
        email,
        category,
        subject,
        message,
        priority
      });

      onShowNotification('Support ticket submitted successfully! Our care team will respond.', 'success');
      setSubject('');
      setMessage('');
      loadUserTickets();
    } catch (err) {
      onShowNotification(err.message || 'Failed to submit support request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-body">
      <div className="greeting-block">
        <h2 className="greeting-title">Help & Support</h2>
        <p className="greeting-sub">Find helpful wound care guidance or submit a support request directly to our team.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* Left Column: Guidance & FAQs */}
        <div>
          <div className="form-card" style={{ marginTop: 0, marginBottom: 20 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 14 }}>
              📸 Best Practices for Wound Photos
            </h3>
            <ul style={{ paddingLeft: 18, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7 }}>
              <li><strong>Lighting:</strong> Take photos in daylight or bright, even room light without harsh flash glare.</li>
              <li><strong>Distance:</strong> Hold your camera approximately 10–12 inches (25–30 cm) from the wound.</li>
              <li><strong>Orientation:</strong> Capture photos directly perpendicular (at a 90° angle) to the skin surface.</li>
              <li><strong>Consistency:</strong> Try to capture follow-up photos under similar lighting and body position.</li>
            </ul>
          </div>

          <div className="form-card" style={{
            background: 'var(--red-light)',
            borderColor: 'var(--red)',
            marginBottom: 20
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ When to Seek Urgent Medical Care
            </h3>
            <p style={{ fontSize: '12.5px', color: '#991B1B', lineHeight: 1.5 }}>
              If you experience any of the following symptoms, do not wait for tracking — contact your physician or visit an urgent care centre immediately:
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 8, color: '#991B1B', fontSize: '12px', lineHeight: 1.6 }}>
              <li>Spreading redness or heat extending beyond wound edges</li>
              <li>Fever, chills, nausea, or systemic malaise</li>
              <li>Foul-smelling or thick yellow/green discharge</li>
              <li>Rapidly increasing throbbing pain or swelling</li>
            </ul>
          </div>

          {/* User's recent tickets */}
          {submittedTickets.length > 0 && (
            <div className="form-card">
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: 12 }}>
                Your Previous Support Requests
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {submittedTickets.map(t => (
                  <div key={t.id} style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border-soft)',
                    fontSize: '12.5px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{t.subject}</span>
                      <span style={{ color: 'var(--blue)', fontSize: '11px' }}>{t.status}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginTop: 2 }}>
                      {t.category} · {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Support Form */}
        <div>
          <form className="form-card" style={{ marginTop: 0 }} onSubmit={handleSubmit}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 6 }}>
              Contact Support
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: 18 }}>
              Need technical assistance or have questions regarding your record storage? Send us a message.
            </p>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input 
                type="text" 
                className="form-input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Email *</label>
              <input 
                type="email" 
                className="form-input" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Technical Issue">Technical Issue</option>
                  <option value="Wound Tracking Question">Wound Tracking Question</option>
                  <option value="Account & Data Privacy">Account & Data Privacy</option>
                  <option value="Feature Feedback">Feature Feedback</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select 
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Brief summary of your question"
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Message *</label>
              <textarea 
                className="form-textarea" 
                placeholder="Please describe your issue or question in detail..."
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                required 
                style={{ minHeight: 110 }}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Submitting Request...' : 'Submit Support Request'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
