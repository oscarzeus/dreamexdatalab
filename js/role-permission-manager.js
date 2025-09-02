/**
 * Role Permission Manager
 * Handles role and permission management for authenticated users
 */

import { getDatabase, ref, get, set, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { auth } from './firebase-config.js';

class RolePermissionManager {
    constructor() {
        this.db = getDatabase();
        this.currentUser = null;
        this.userCompanyId = null;
        this.availableRoles = [];
        this.permissions = {};
        
        this.initialize();
    }

    async initialize() {
        // Wait for authentication
        if (auth.currentUser) {
            this.currentUser = auth.currentUser;
            await this.loadUserData();
        } else {
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    await this.loadUserData();
                }
            });
        }
    }

    async loadUserData() {
        try {
            // Get user's company information
            const userRef = ref(this.db, `users/${this.currentUser.uid}`);
            const userSnapshot = await get(userRef);
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                this.userCompanyId = userData.companyId;
                
                // Load company-specific roles and permissions
                await this.loadCompanyRoles();
                await this.loadPermissions();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadCompanyRoles() {
        if (!this.userCompanyId) return;

        try {
            // Load company-specific roles
            const rolesRef = ref(this.db, `companies/${this.userCompanyId}/roles`);
            const rolesSnapshot = await get(rolesRef);
            
            if (rolesSnapshot.exists()) {
                this.availableRoles = Object.entries(rolesSnapshot.val()).map(([id, role]) => ({
                    id,
                    ...role
                }));
            } else {
                // Initialize with default roles if none exist
                this.availableRoles = this.getDefaultRoles();
                await this.saveDefaultRoles();
            }
        } catch (error) {
            console.error('Error loading company roles:', error);
            this.availableRoles = this.getDefaultRoles();
        }
    }

    async loadPermissions() {
        try {
            // Load available permissions structure
            const permissionsRef = ref(this.db, 'systemPermissions');
            const permissionsSnapshot = await get(permissionsRef);
            
            if (permissionsSnapshot.exists()) {
                this.permissions = permissionsSnapshot.val();
            } else {
                // Initialize with default permissions structure
                this.permissions = this.getDefaultPermissions();
                await this.saveDefaultPermissions();
            }
        } catch (error) {
            console.error('Error loading permissions:', error);
            this.permissions = this.getDefaultPermissions();
        }
    }

    getDefaultRoles() {
        return [
            {
                id: 'manager',
                name: 'Manager',
                description: 'Can manage team members and view reports',
                permissions: ['company_management_view', 'company_management_edit', 'safety_view', 'safety_create', 'safety_edit', 'user_management_view', 'user_management_edit', 'hr_view', 'human_hr_view', 'staff_management_view', 'staff_management_create', 'staff_management_edit', 'staff_management_delete', 'kpi_view'],
                isCustom: false,
                createdAt: new Date().toISOString(),
                userCount: 0
            },
            {
                id: 'employee',
                name: 'Employee',
                description: 'Standard employee access',
                permissions: ['company_management_view', 'safety_view', 'safety_create', 'user_management_view', 'hr_view', 'human_hr_view', 'staff_management_view', 'kpi_view'],
                isCustom: false,
                createdAt: new Date().toISOString(),
                userCount: 0
            },
            {
                id: 'viewer',
                name: 'Viewer',
                description: 'Read-only access to most features',
                permissions: ['company_management_view', 'safety_view', 'user_management_view', 'hr_view', 'human_hr_view', 'kpi_view'],
                isCustom: false,
                createdAt: new Date().toISOString(),
                userCount: 0
            }
        ];
    }

    getDefaultPermissions() {
        return {
            settings: {
                company_management: {
                    view: { name: 'View Company Management', description: 'View company information and settings' },
                    create: { name: 'Create Company Data', description: 'Create new company records' },
                    edit: { name: 'Edit Company Data', description: 'Modify company information' },
                    delete: { name: 'Delete Company Data', description: 'Remove company records' }
                },
                safety_management: {
                    view: { name: 'View Safety', description: 'View safety reports and data' },
                    create: { name: 'Create Safety Records', description: 'Create new safety reports' },
                    edit: { name: 'Edit Safety Records', description: 'Modify safety reports' },
                    delete: { name: 'Delete Safety Records', description: 'Remove safety reports' }
                },
                user_management: {
                    view: { name: 'View Users', description: 'View user accounts and profiles' },
                    create: { name: 'Create Users', description: 'Add new user accounts' },
                    edit: { name: 'Edit Users', description: 'Modify user accounts' },
                    delete: { name: 'Delete Users', description: 'Remove user accounts' }
                },
                hr_management: {
                    view: { name: 'View HR', description: 'View HR records and reports' },
                    create: { name: 'Create HR Records', description: 'Create new HR entries' },
                    edit: { name: 'Edit HR Records', description: 'Modify HR information' },
                    delete: { name: 'Delete HR Records', description: 'Remove HR records' }
                },
                human_hr_management: {
                    view: { name: 'View Human HR', description: 'Access human resources management features' },
                    create: { name: 'Create Human HR Records', description: 'Create new human HR entries' },
                    edit: { name: 'Edit Human HR Records', description: 'Modify human HR information' },
                    delete: { name: 'Delete Human HR Records', description: 'Remove human HR records' }
                },
                staff_management: {
                    view: { name: 'View Staff', description: 'View staff information' },
                    create: { name: 'Create Staff Records', description: 'Add new staff members' },
                    edit: { name: 'Edit Staff Records', description: 'Modify staff information' },
                    delete: { name: 'Delete Staff Records', description: 'Remove staff records' },
                    export: { name: 'Export Staff Data', description: 'Export staff information' },
                    import: { name: 'Import Staff Data', description: 'Import staff information' }
                },
                kpi_management: {
                    view: { name: 'View KPI', description: 'View KPI dashboards and reports' },
                    create: { name: 'Create KPI', description: 'Create new KPI metrics' },
                    edit: { name: 'Edit KPI', description: 'Modify KPI settings' },
                    delete: { name: 'Delete KPI', description: 'Remove KPI metrics' }
                }
            }
        };
    }

    async saveDefaultRoles() {
        if (!this.userCompanyId) return;

        try {
            const rolesRef = ref(this.db, `companies/${this.userCompanyId}/roles`);
            const rolesData = {};
            
            this.availableRoles.forEach(role => {
                rolesData[role.id] = {
                    name: role.name,
                    description: role.description,
                    permissions: role.permissions,
                    isCustom: role.isCustom,
                    createdAt: role.createdAt,
                    userCount: role.userCount
                };
            });
            
            await set(rolesRef, rolesData);
        } catch (error) {
            console.error('Error saving default roles:', error);
        }
    }

    async saveDefaultPermissions() {
        try {
            const permissionsRef = ref(this.db, 'systemPermissions');
            await set(permissionsRef, this.permissions);
        } catch (error) {
            console.error('Error saving default permissions:', error);
        }
    }

    // Public methods for role management
    async createRole(roleData) {
        if (!this.userCompanyId) throw new Error('No company context');

        try {
            const roleId = roleData.name.toLowerCase().replace(/\s+/g, '_');
            const newRole = {
                name: roleData.name,
                description: roleData.description,
                permissions: roleData.permissions || [],
                isCustom: true,
                createdAt: new Date().toISOString(),
                createdBy: this.currentUser.uid,
                userCount: 0
            };

            const roleRef = ref(this.db, `companies/${this.userCompanyId}/roles/${roleId}`);
            await set(roleRef, newRole);

            // Update local cache
            this.availableRoles.push({ id: roleId, ...newRole });

            return { id: roleId, ...newRole };
        } catch (error) {
            console.error('Error creating role:', error);
            throw error;
        }
    }

    async updateRole(roleId, updates) {
        if (!this.userCompanyId) throw new Error('No company context');

        try {
            const roleRef = ref(this.db, `companies/${this.userCompanyId}/roles/${roleId}`);
            const updateData = {
                ...updates,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser.uid
            };

            await set(roleRef, updateData);

            // Update local cache
            const roleIndex = this.availableRoles.findIndex(r => r.id === roleId);
            if (roleIndex !== -1) {
                this.availableRoles[roleIndex] = { id: roleId, ...updateData };
            }

            return { id: roleId, ...updateData };
        } catch (error) {
            console.error('Error updating role:', error);
            throw error;
        }
    }

    async deleteRole(roleId) {
        if (!this.userCompanyId) throw new Error('No company context');

        try {
            // Check if role is in use
            const role = this.availableRoles.find(r => r.id === roleId);
            if (role && role.userCount > 0) {
                throw new Error('Cannot delete role that is assigned to users');
            }

            const roleRef = ref(this.db, `companies/${this.userCompanyId}/roles/${roleId}`);
            await remove(roleRef);

            // Update local cache
            this.availableRoles = this.availableRoles.filter(r => r.id !== roleId);

            return true;
        } catch (error) {
            console.error('Error deleting role:', error);
            throw error;
        }
    }

    // Getters
    getRoles() {
        return this.availableRoles;
    }

    getPermissions() {
        return this.permissions;
    }

    getRoleById(roleId) {
        return this.availableRoles.find(role => role.id === roleId);
    }

    // Check if current user can manage roles
    canManageRoles() {
        // All authenticated users with company access can manage roles
        return this.currentUser && this.userCompanyId;
    }
}

// Create and export singleton instance
const rolePermissionManager = new RolePermissionManager();
export default rolePermissionManager;

// Also export class for direct instantiation if needed
export { RolePermissionManager };
