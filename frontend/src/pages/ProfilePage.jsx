import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export function ProfilePage() {
  const { user, isAdmin, refreshProfile } = useAuth();
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    department: user?.department || '',
    phone: user?.phone || '',
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwdForm, setPwdForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const [teamUsers, setTeamUsers] = useState([]);
  const [teamErr, setTeamErr] = useState('');

  useEffect(() => {
    if (isAdmin) {
      api
        .getUsers()
        .then(setTeamUsers)
        .catch((err) => setTeamErr(err.message));
    }
  }, [isAdmin]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      await api.updateProfile(profileForm);
      await refreshProfile();
      setProfileMsg('Profile details updated.');
    } catch (err) {
      setProfileErr(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      setPwdErr('New passwords do not match.');
      return;
    }
    setSavingPwd(true);
    try {
      await api.changePassword({
        current_password: pwdForm.current_password,
        new_password: pwdForm.new_password,
      });
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwdMsg('Password changed successfully.');
    } catch (err) {
      setPwdErr(err.message || 'Failed to change password');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleRoleChange = async (targetUser, newRole, newActive) => {
    setTeamErr('');
    try {
      const updated = await api.updateUserRole(targetUser.id, {
        role: newRole,
        is_active: newActive,
      });
      setTeamUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setTeamErr(err.message || 'Failed to update user access');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile & Access Management</h1>
          <p className="page-subtitle">
            Manage your biomedical engineer credentials, security settings, and hospital team roles
          </p>
        </div>
      </div>

      <div className="charts-grid">
        {/* Profile Form */}
        <div className="card col-6">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCog size={18} color="#0d9488" />
              <h3 className="card-title">Personal Profile</h3>
            </div>
            <span className={`role-pill ${isAdmin ? 'admin' : ''}`}>
              {isAdmin ? 'Administrator' : 'Biomedical Engineer'}
            </span>
          </div>
          <div className="card-body">
            {profileMsg && (
              <div className="alert alert-success">
                <CheckCircle2 size={18} />
                <span>{profileMsg}</span>
              </div>
            )}
            {profileErr && (
              <div className="alert alert-danger">
                <AlertCircle size={18} />
                <span>{profileErr}</span>
              </div>
            )}
            <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  required
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Work Email</label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  value={profileForm.department}
                  onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone / Extension</label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>
              <div>
                <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Password Change */}
        <div className="card col-6">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={18} color="#0284c7" />
              <h3 className="card-title">Security & Password</h3>
            </div>
          </div>
          <div className="card-body">
            {pwdMsg && (
              <div className="alert alert-success">
                <CheckCircle2 size={18} />
                <span>{pwdMsg}</span>
              </div>
            )}
            {pwdErr && (
              <div className="alert alert-danger">
                <AlertCircle size={18} />
                <span>{pwdErr}</span>
              </div>
            )}
            <form onSubmit={handlePasswordSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  required
                  value={pwdForm.current_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>New Password (min. 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={pwdForm.new_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={pwdForm.confirm_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                />
              </div>
              <div>
                <button type="submit" className="btn btn-secondary" disabled={savingPwd}>
                  {savingPwd ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Admin Team Management */}
      {isAdmin && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="#6d28d9" />
              <h3 className="card-title">Staff & Role Management (Administrator Only)</h3>
            </div>
          </div>
          {teamErr && (
            <div className="alert alert-danger" style={{ margin: 16 }}>
              <AlertCircle size={18} />
              <span>{teamErr}</span>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Account Status</th>
                </tr>
              </thead>
              <tbody>
                {teamUsers.map((member) => (
                  <tr key={member.id}>
                    <td style={{ fontWeight: 600 }}>{member.full_name}</td>
                    <td>{member.email}</td>
                    <td>{member.department || '—'}</td>
                    <td>
                      <select
                        style={{ width: 190 }}
                        value={member.role}
                        disabled={member.id === user?.id}
                        onChange={(e) => handleRoleChange(member, e.target.value, member.is_active)}
                      >
                        <option value="biomedical_engineer">Biomedical Engineer</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusBadge value={member.is_active ? 'Operational' : 'Out of Service'} />
                        {member.id !== user?.id && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRoleChange(member, member.role, !member.is_active)}
                          >
                            {member.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
