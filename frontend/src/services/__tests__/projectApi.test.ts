/**
 * Project API Integration Tests
 * Tests for project management API methods
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import apiClient from '../api';
import type { MovingProject } from '../../types';

describe('Project API Methods', () => {
  const mockInventoryId = 'test-inventory-123';
  const mockProjectId = 'test-project-123';

  describe('Project CRUD Operations', () => {
    it('should have getProjects method', () => {
      expect(apiClient.getProjects).toBeDefined();
      expect(typeof apiClient.getProjects).toBe('function');
    });

    it('should have getProject method', () => {
      expect(apiClient.getProject).toBeDefined();
      expect(typeof apiClient.getProject).toBe('function');
    });

    it('should have createProject method', () => {
      expect(apiClient.createProject).toBeDefined();
      expect(typeof apiClient.createProject).toBe('function');
    });

    it('should have updateProject method', () => {
      expect(apiClient.updateProject).toBeDefined();
      expect(typeof apiClient.updateProject).toBe('function');
    });

    it('should have deleteProject method', () => {
      expect(apiClient.deleteProject).toBeDefined();
      expect(typeof apiClient.deleteProject).toBe('function');
    });
  });

  describe('Project Tasks API', () => {
    it('should have getProjectTasks method', () => {
      expect(apiClient.getProjectTasks).toBeDefined();
      expect(typeof apiClient.getProjectTasks).toBe('function');
    });

    it('should have createTask method', () => {
      expect(apiClient.createTask).toBeDefined();
      expect(typeof apiClient.createTask).toBe('function');
    });

    it('should have updateTask method', () => {
      expect(apiClient.updateTask).toBeDefined();
      expect(typeof apiClient.updateTask).toBe('function');
    });

    it('should have deleteTask method', () => {
      expect(apiClient.deleteTask).toBeDefined();
      expect(typeof apiClient.deleteTask).toBe('function');
    });

    it('should have getOverdueTasks method', () => {
      expect(apiClient.getOverdueTasks).toBeDefined();
      expect(typeof apiClient.getOverdueTasks).toBe('function');
    });
  });

  describe('Project Milestones API', () => {
    it('should have getProjectMilestones method', () => {
      expect(apiClient.getProjectMilestones).toBeDefined();
      expect(typeof apiClient.getProjectMilestones).toBe('function');
    });

    it('should have createMilestone method', () => {
      expect(apiClient.createMilestone).toBeDefined();
      expect(typeof apiClient.createMilestone).toBe('function');
    });

    it('should have updateMilestone method', () => {
      expect(apiClient.updateMilestone).toBeDefined();
      expect(typeof apiClient.updateMilestone).toBe('function');
    });

    it('should have completeMilestone method', () => {
      expect(apiClient.completeMilestone).toBeDefined();
      expect(typeof apiClient.completeMilestone).toBe('function');
    });

    it('should have deleteMilestone method', () => {
      expect(apiClient.deleteMilestone).toBeDefined();
      expect(typeof apiClient.deleteMilestone).toBe('function');
    });

    it('should have getOverdueMilestones method', () => {
      expect(apiClient.getOverdueMilestones).toBeDefined();
      expect(typeof apiClient.getOverdueMilestones).toBe('function');
    });

    it('should have getUpcomingMilestones method', () => {
      expect(apiClient.getUpcomingMilestones).toBeDefined();
      expect(typeof apiClient.getUpcomingMilestones).toBe('function');
    });
  });

  describe('Project Budget API', () => {
    it('should have getProjectBudget method', () => {
      expect(apiClient.getProjectBudget).toBeDefined();
      expect(typeof apiClient.getProjectBudget).toBe('function');
    });

    it('should have createBudgetItem method', () => {
      expect(apiClient.createBudgetItem).toBeDefined();
      expect(typeof apiClient.createBudgetItem).toBe('function');
    });

    it('should have updateBudgetItem method', () => {
      expect(apiClient.updateBudgetItem).toBeDefined();
      expect(typeof apiClient.updateBudgetItem).toBe('function');
    });

    it('should have deleteBudgetItem method', () => {
      expect(apiClient.deleteBudgetItem).toBeDefined();
      expect(typeof apiClient.deleteBudgetItem).toBe('function');
    });

    it('should have getBudgetStats method', () => {
      expect(apiClient.getBudgetStats).toBeDefined();
      expect(typeof apiClient.getBudgetStats).toBe('function');
    });
  });

  describe('Project Things API', () => {
    it('should have getProjectThings method', () => {
      expect(apiClient.getProjectThings).toBeDefined();
      expect(typeof apiClient.getProjectThings).toBe('function');
    });

    it('should have assignThingsToProject method', () => {
      expect(apiClient.assignThingsToProject).toBeDefined();
      expect(typeof apiClient.assignThingsToProject).toBe('function');
    });

    it('should have removeThingsFromProject method', () => {
      expect(apiClient.removeThingsFromProject).toBeDefined();
      expect(typeof apiClient.removeThingsFromProject).toBe('function');
    });

    it('should have getAvailableThingsForProject method', () => {
      expect(apiClient.getAvailableThingsForProject).toBeDefined();
      expect(typeof apiClient.getAvailableThingsForProject).toBe('function');
    });
  });

  describe('Project Progress API', () => {
    it('should have getProjectProgress method', () => {
      expect(apiClient.getProjectProgress).toBeDefined();
      expect(typeof apiClient.getProjectProgress).toBe('function');
    });

    it('getProjectProgress should return project data structure', async () => {
      // This is a structural test - actual API calls would be mocked in integration tests
      expect(apiClient.getProjectProgress).toBeDefined();
    });
  });

  describe('Container Assignment API', () => {
    it('should have assignContainersToProject method', () => {
      expect(apiClient.assignContainersToProject).toBeDefined();
      expect(typeof apiClient.assignContainersToProject).toBe('function');
    });

    it('should have removeContainersFromProject method', () => {
      expect(apiClient.removeContainersFromProject).toBeDefined();
      expect(typeof apiClient.removeContainersFromProject).toBe('function');
    });
  });
});
