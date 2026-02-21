
import os

file_path = r'c:\Users\anil9\Downloads\RSA System\pages\TasksPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_marker = "{/* Modals for Create/Edit/Templates */}"
end_marker = "{isTemplateManagerOpen && <TemplateManager onClose={() => setIsTemplateManagerOpen(false)} />}"

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if start_marker in line:
        start_idx = i
    if end_marker in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_pane = """            {/* Task Detail Slide-over */}
            <TaskDetailPane
                task={currentTask}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedTaskId(undefined);
                }}
                onSave={handleSaveTask}
                onDelete={handleDeleteTask}
                onChange={(updates) => setCurrentTask({ ...currentTask, ...updates })}
                usersList={usersList}
                clientsList={clientsList}
                isSaving={isSaving}
                isEditMode={isEditMode}
                canManageTask={canManageTask}
                dateMode={dateMode}
                setDateMode={setDateMode}
                newSubtaskTitle={newSubtaskTitle}
                setNewSubtaskTitle={setNewSubtaskTitle}
                onAddSubtask={handleAddSubtask}
                onRemoveSubtask={handleRemoveSubtask}
                onAddComment={handleAddComment}
            />\n\n"""
    
    # We want to replace everything from start_marker (inclusive) to end_marker (exclusive)
    # Actually, let's replace from the '{' that follows start_marker.
    # Looking at the file:
    # 835:             {/* Modals for Create/Edit/Templates */}
    # 836:             {
    # ...
    # 1115:             }
    
    # Let's find the closing '}' of the isModalOpen block before isTemplateModalOpen begins.
    
    modal_end_idx = -1
    for i in range(start_idx + 1, end_idx):
        if 'isTemplateModalOpen && (' in lines[i]:
            # The bracket before this is likely the end of the previous block
            for j in range(i-1, start_idx, -1):
                if '}' in lines[j]:
                    modal_end_idx = j
                    break
            break
    
    if modal_end_idx != -1:
        new_lines = lines[:start_idx + 1] + [new_pane] + lines[modal_end_idx + 1:]
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print("Successfully replaced modal with TaskDetailPane")
    else:
        print("Could not find end of modal block")
else:
    print(f"Markers not found: start={start_idx}, end={end_idx}")
