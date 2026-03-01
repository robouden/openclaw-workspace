/**
 * AnyType Workspace Sync Helper for OpenClaw
 *
 * Simple interface to write, update, and delete notes in AnyType
 * via the filesystem-based sync service.
 *
 * Usage:
 *   const AnyType = require('./anytype-helper');
 *   const anytype = new AnyType();
 *
 *   await anytype.write('meeting-notes', 'Meeting Notes', 'Discussion about...');
 *   await anytype.update('meeting-notes', 'Updated content...');
 *   await anytype.delete('meeting-notes');
 */

const fs = require('fs').promises;
const path = require('path');

class AnyTypeHelper {
    constructor(workspaceDir = '/root/anytype-workspace') {
        this.workspaceDir = workspaceDir;
    }

    /**
     * Write a new note to AnyType
     *
     * @param {string} id - Unique identifier for the note (used as filename)
     * @param {string} title - Note title (will be the first heading)
     * @param {string} content - Note content (markdown)
     * @returns {Promise<void>}
     *
     * @example
     * await anytype.write('daily-log', 'Daily Log', 'Today I worked on...');
     */
    async write(id, title, content) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);
        const markdown = `# ${title}\n\n${content}`;

        try {
            await fs.writeFile(filepath, markdown, 'utf8');
            console.log(`[AnyType] ✓ Written: ${id}`);
        } catch (error) {
            console.error(`[AnyType] ✗ Write failed for ${id}:`, error.message);
            throw error;
        }
    }

    /**
     * Update an existing note (or create if doesn't exist)
     *
     * @param {string} id - Note identifier
     * @param {string} content - Full markdown content (must include # Title)
     * @returns {Promise<void>}
     *
     * @example
     * await anytype.update('daily-log', '# Daily Log\n\nUpdated content...');
     */
    async update(id, content) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);

        try {
            await fs.writeFile(filepath, content, 'utf8');
            console.log(`[AnyType] ✓ Updated: ${id}`);
        } catch (error) {
            console.error(`[AnyType] ✗ Update failed for ${id}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete a note from AnyType
     *
     * @param {string} id - Note identifier
     * @returns {Promise<void>}
     *
     * @example
     * await anytype.delete('old-note');
     */
    async delete(id) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);

        try {
            await fs.unlink(filepath);
            console.log(`[AnyType] ✓ Deleted: ${id}`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`[AnyType] ⚠ Already deleted: ${id}`);
            } else {
                console.error(`[AnyType] ✗ Delete failed for ${id}:`, error.message);
                throw error;
            }
        }
    }

    /**
     * Read a note's content
     *
     * @param {string} id - Note identifier
     * @returns {Promise<string>} Note content
     *
     * @example
     * const content = await anytype.read('daily-log');
     */
    async read(id) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);

        try {
            return await fs.readFile(filepath, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            console.error(`[AnyType] ✗ Read failed for ${id}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if a note exists
     *
     * @param {string} id - Note identifier
     * @returns {Promise<boolean>}
     *
     * @example
     * if (await anytype.exists('daily-log')) { ... }
     */
    async exists(id) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);

        try {
            await fs.access(filepath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * List all synced note IDs
     *
     * @returns {Promise<string[]>} Array of note IDs
     *
     * @example
     * const notes = await anytype.list();
     * console.log('Synced notes:', notes);
     */
    async list() {
        try {
            const files = await fs.readdir(this.workspaceDir);
            return files
                .filter(f => f.endsWith('.md'))
                .map(f => f.replace('.md', ''));
        } catch (error) {
            console.error('[AnyType] ✗ List failed:', error.message);
            throw error;
        }
    }

    /**
     * Append content to an existing note
     *
     * @param {string} id - Note identifier
     * @param {string} content - Content to append
     * @returns {Promise<void>}
     *
     * @example
     * await anytype.append('daily-log', '\n\n## Update\nNew information...');
     */
    async append(id, content) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);

        try {
            await fs.appendFile(filepath, content, 'utf8');
            console.log(`[AnyType] ✓ Appended to: ${id}`);
        } catch (error) {
            console.error(`[AnyType] ✗ Append failed for ${id}:`, error.message);
            throw error;
        }
    }

    /**
     * Format a MongoDB document as markdown note
     *
     * @param {Object} doc - MongoDB document
     * @param {string} doc._id - Document ID
     * @param {string} doc.title - Document title
     * @param {Object} doc - Other document fields
     * @returns {Object} {id, title, content}
     *
     * @example
     * const note = anytype.formatFromMongo(mongoDoc);
     * await anytype.write(note.id, note.title, note.content);
     */
    formatFromMongo(doc) {
        const id = `mongo-${doc._id}`;
        const title = doc.title || `Document ${doc._id}`;

        let content = '';

        // Add timestamp if available
        if (doc.createdAt) {
            content += `**Created**: ${new Date(doc.createdAt).toISOString()}\n\n`;
        }

        // Add all fields except internal ones
        for (const [key, value] of Object.entries(doc)) {
            if (key.startsWith('_') || key === 'title' || key === 'createdAt') {
                continue;
            }

            if (typeof value === 'object') {
                content += `## ${key}\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
            } else {
                content += `**${key}**: ${value}\n\n`;
            }
        }

        return { id, title, content: content.trim() };
    }

    /**
     * Sync a MongoDB document to AnyType
     *
     * @param {Object} doc - MongoDB document
     * @returns {Promise<void>}
     *
     * @example
     * mongoChangeStream.on('change', async (change) => {
     *     await anytype.syncFromMongo(change.fullDocument);
     * });
     */
    async syncFromMongo(doc) {
        const { id, title, content } = this.formatFromMongo(doc);
        await this.write(id, title, content);
    }

    /**
     * Create a timestamped log entry
     *
     * @param {string} title - Log title
     * @param {string} content - Log content
     * @param {string} [prefix='log'] - Filename prefix
     * @returns {Promise<string>} Generated ID
     *
     * @example
     * const logId = await anytype.log('System Event', 'Server restarted');
     */
    async log(title, content, prefix = 'log') {
        const timestamp = Date.now();
        const id = `${prefix}-${timestamp}`;

        const fullContent = `**Timestamp**: ${new Date().toISOString()}\n\n${content}`;
        await this.write(id, title, fullContent);

        return id;
    }

    /**
     * Create a task note
     *
     * @param {Object} task - Task object
     * @param {string} task.id - Task ID
     * @param {string} task.title - Task title
     * @param {string} [task.description] - Task description
     * @param {string} [task.status] - Task status
     * @param {string} [task.priority] - Task priority
     * @returns {Promise<void>}
     *
     * @example
     * await anytype.createTask({
     *     id: '123',
     *     title: 'Fix authentication bug',
     *     description: 'Users unable to login',
     *     status: 'in-progress',
     *     priority: 'high'
     * });
     */
    async createTask(task) {
        const content = `
**Status**: ${task.status || 'pending'}
**Priority**: ${task.priority || 'normal'}

## Description
${task.description || 'No description provided.'}

## Notes
${task.notes || ''}
`.trim();

        await this.write(`task-${task.id}`, task.title, content);
    }

    /**
     * Update task status
     *
     * @param {string} taskId - Task ID
     * @param {string} status - New status
     * @returns {Promise<void>}
     *
     * @example
     * await anytype.updateTaskStatus('123', 'completed');
     */
    async updateTaskStatus(taskId, status) {
        const id = `task-${taskId}`;
        const content = await this.read(id);

        if (!content) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Update status line
        const updated = content.replace(
            /\*\*Status\*\*: .+/,
            `**Status**: ${status}`
        );

        await this.update(id, updated);
    }
}

module.exports = AnyTypeHelper;

// Example usage:
if (require.main === module) {
    (async () => {
        const anytype = new AnyTypeHelper();

        console.log('Testing AnyType Helper...');

        // Write a test note
        await anytype.write('test-note', 'Test Note', 'This is a test note from OpenClaw.');

        // List all notes
        const notes = await anytype.list();
        console.log('Synced notes:', notes);

        // Read the note
        const content = await anytype.read('test-note');
        console.log('Note content:', content);

        // Append to note
        await anytype.append('test-note', '\n\n## Update\nAppended content.');

        // Update note
        await anytype.update('test-note', '# Test Note\n\nCompletely updated content.');

        // Check existence
        console.log('Exists:', await anytype.exists('test-note'));

        // Delete note
        await anytype.delete('test-note');

        console.log('✓ All tests passed!');
    })();
}
