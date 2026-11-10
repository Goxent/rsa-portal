import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
    HandbookMetadata,
    HandbookSection,
    WorkstationTable,
    DEFAULT_HANDBOOK_METADATA,
    DEFAULT_HANDBOOK_SECTIONS,
    DEFAULT_WORKSTATION_TABLES,
    DEFAULT_ESCALATION_STEPS,
    DEFAULT_ROLE_RESPONSIBILITIES,
    IssueEscalationStep,
    RoleResponsibility,
} from '../constants/handbook';
import { UserProfile, UserRole } from '../types';

export interface CompleteHandbookData {
    metadata: HandbookMetadata;
    sections: HandbookSection[];
    workstationTables: WorkstationTable[];
    escalationSteps: IssueEscalationStep[];
    roleResponsibilities: RoleResponsibility[];
    lastUpdated?: string;
    updatedBy?: string;
}

export const PolicyService = {
    /**
     * Subscribes to real-time handbook updates from Firestore.
     * Falls back to built-in defaults if no document exists yet.
     */
    subscribeHandbook(
        onUpdate: (data: CompleteHandbookData) => void,
        onError?: (err: any) => void
    ) {
        const docRef = doc(db, 'systemSettings', 'handbook');
        return onSnapshot(
            docRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as Partial<CompleteHandbookData>;
                    onUpdate({
                        metadata: { ...DEFAULT_HANDBOOK_METADATA, ...(data.metadata || {}) },
                        sections: data.sections && data.sections.length > 0 ? data.sections : DEFAULT_HANDBOOK_SECTIONS,
                        workstationTables: data.workstationTables && data.workstationTables.length > 0 ? data.workstationTables : DEFAULT_WORKSTATION_TABLES,
                        escalationSteps: data.escalationSteps && data.escalationSteps.length > 0 ? data.escalationSteps : DEFAULT_ESCALATION_STEPS,
                        roleResponsibilities: data.roleResponsibilities && data.roleResponsibilities.length > 0 ? data.roleResponsibilities : DEFAULT_ROLE_RESPONSIBILITIES,
                        lastUpdated: data.lastUpdated,
                        updatedBy: data.updatedBy,
                    });
                } else {
                    onUpdate({
                        metadata: DEFAULT_HANDBOOK_METADATA,
                        sections: DEFAULT_HANDBOOK_SECTIONS,
                        workstationTables: DEFAULT_WORKSTATION_TABLES,
                        escalationSteps: DEFAULT_ESCALATION_STEPS,
                        roleResponsibilities: DEFAULT_ROLE_RESPONSIBILITIES,
                    });
                }
            },
            (error) => {
                console.warn('Firestore handbook subscribe fallback:', error);
                if (onError) onError(error);
                // Graceful fallback to default in case of permission or network issue
                onUpdate({
                    metadata: DEFAULT_HANDBOOK_METADATA,
                    sections: DEFAULT_HANDBOOK_SECTIONS,
                    workstationTables: DEFAULT_WORKSTATION_TABLES,
                    escalationSteps: DEFAULT_ESCALATION_STEPS,
                    roleResponsibilities: DEFAULT_ROLE_RESPONSIBILITIES,
                });
            }
        );
    },

    /**
     * One-time fetch of handbook data
     */
    async getHandbook(): Promise<CompleteHandbookData> {
        try {
            const docRef = doc(db, 'systemSettings', 'handbook');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data() as Partial<CompleteHandbookData>;
                return {
                    metadata: { ...DEFAULT_HANDBOOK_METADATA, ...(data.metadata || {}) },
                    sections: data.sections && data.sections.length > 0 ? data.sections : DEFAULT_HANDBOOK_SECTIONS,
                    workstationTables: data.workstationTables && data.workstationTables.length > 0 ? data.workstationTables : DEFAULT_WORKSTATION_TABLES,
                    escalationSteps: data.escalationSteps && data.escalationSteps.length > 0 ? data.escalationSteps : DEFAULT_ESCALATION_STEPS,
                    roleResponsibilities: data.roleResponsibilities && data.roleResponsibilities.length > 0 ? data.roleResponsibilities : DEFAULT_ROLE_RESPONSIBILITIES,
                    lastUpdated: data.lastUpdated,
                    updatedBy: data.updatedBy,
                };
            }
        } catch (err) {
            console.warn('Failed to load handbook from Firestore, using default:', err);
        }
        return {
            metadata: DEFAULT_HANDBOOK_METADATA,
            sections: DEFAULT_HANDBOOK_SECTIONS,
            workstationTables: DEFAULT_WORKSTATION_TABLES,
            escalationSteps: DEFAULT_ESCALATION_STEPS,
            roleResponsibilities: DEFAULT_ROLE_RESPONSIBILITIES,
        };
    },

    /**
     * Saves updated handbook data to Firestore.
     * Enforced for MASTER_ADMIN role.
     */
    async saveHandbook(
        user: UserProfile,
        data: {
            metadata: HandbookMetadata;
            sections: HandbookSection[];
            workstationTables?: WorkstationTable[];
        }
    ): Promise<void> {
        if (!user || user.role !== UserRole.MASTER_ADMIN) {
            throw new Error('Unauthorized: Only Master Admin can modify firm handbook policies.');
        }

        const docRef = doc(db, 'systemSettings', 'handbook');
        const now = new Date().toISOString();

        await setDoc(
            docRef,
            {
                metadata: data.metadata,
                sections: data.sections,
                workstationTables: data.workstationTables || DEFAULT_WORKSTATION_TABLES,
                escalationSteps: DEFAULT_ESCALATION_STEPS,
                roleResponsibilities: DEFAULT_ROLE_RESPONSIBILITIES,
                lastUpdated: now,
                updatedBy: user.uid,
                updatedByName: user.displayName || 'Master Admin',
            },
            { merge: true }
        );
    },

    /**
     * Resets the handbook back to the official firm defaults.
     */
    async resetToDefault(user: UserProfile): Promise<void> {
        if (!user || user.role !== UserRole.MASTER_ADMIN) {
            throw new Error('Unauthorized: Only Master Admin can reset firm policies.');
        }

        const docRef = doc(db, 'systemSettings', 'handbook');
        await setDoc(docRef, {
            metadata: DEFAULT_HANDBOOK_METADATA,
            sections: DEFAULT_HANDBOOK_SECTIONS,
            workstationTables: DEFAULT_WORKSTATION_TABLES,
            escalationSteps: DEFAULT_ESCALATION_STEPS,
            roleResponsibilities: DEFAULT_ROLE_RESPONSIBILITIES,
            lastUpdated: new Date().toISOString(),
            updatedBy: user.uid,
            updatedByName: user.displayName || 'Master Admin',
        });
    },
};
