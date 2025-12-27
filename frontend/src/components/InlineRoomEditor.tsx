import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  Divider,
  Fade,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { Room } from '../types/entities';

interface InlineRoomEditorProps {
  rooms: Room[];
  onAddRoom: (roomData: { name: string }) => Promise<void>;
  onUpdateRoom: (roomId: string, roomData: { name: string }) => Promise<void>;
  onDeleteRoom: (roomId: string) => Promise<void>;
  disabled?: boolean;
}

interface EditingRoom {
  id?: string;
  name: string;
  isNew: boolean;
}

export default function InlineRoomEditor({
  rooms,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  disabled = false,
}: InlineRoomEditorProps) {
  const [editingRoom, setEditingRoom] = useState<EditingRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle adding a new room
  const handleAddRoom = () => {
    if (editingRoom) return; // Don't allow multiple edits
    
    setEditingRoom({
      name: '',
      isNew: true,
    });
  };

  // Handle editing an existing room
  const handleEditRoom = (room: Room) => {
    if (editingRoom) return; // Don't allow multiple edits
    
    setEditingRoom({
      id: room.id,
      name: room.name,
      isNew: false,
    });
  };

  // Handle saving a room (new or edited)
  const handleSaveRoom = async () => {
    if (!editingRoom || !editingRoom.name.trim()) return;

    setIsLoading(true);
    try {
      const roomData = {
        name: editingRoom.name.trim(),
      };

      if (editingRoom.isNew) {
        await onAddRoom(roomData);
      } else if (editingRoom.id) {
        await onUpdateRoom(editingRoom.id, roomData);
      }
    } catch (error) {
      console.error('Error saving room:', error);
      // Could show a toast notification here in the future
    } finally {
      setEditingRoom(null);
      setIsLoading(false);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingRoom(null);
  };

  // Handle deleting a room
  const handleDeleteRoom = async (roomId: string) => {
    if (editingRoom) return; // Don't allow delete while editing
    
    setIsLoading(true);
    try {
      await onDeleteRoom(roomId);
    } catch (error) {
      console.error('Error deleting room:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press for quick save
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveRoom();
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Rooms ({rooms.length})
        </Typography>
        <IconButton
          size="small"
          onClick={handleAddRoom}
          disabled={disabled || !!editingRoom || isLoading}
          sx={{
            width: 28,
            height: 28,
            border: 1,
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
            },
            '&:disabled': {
              borderColor: 'action.disabled',
              color: 'action.disabled',
            },
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Room List */}
      <Box sx={{ 
        border: 1, 
        borderColor: 'divider', 
        borderRadius: 1,
        minHeight: rooms.length === 0 && !editingRoom ? 60 : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {rooms.length === 0 && !editingRoom ? (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            py: 2,
            color: 'text.secondary',
          }}>
            <Typography variant="body2">
              No rooms yet. Click + to add one.
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0 }}>
            {/* Existing rooms */}
            {rooms.map((room, index) => (
              <Box key={room.id}>
                {editingRoom?.id === room.id ? (
                  // Editing mode
                  <ListItem sx={{ py: 1.5, px: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <TextField
                          size="small"
                          placeholder="Room name"
                          value={editingRoom.name}
                          onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                          onKeyDown={handleKeyPress}
                          autoFocus
                          fullWidth
                          disabled={isLoading}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={handleSaveRoom}
                          disabled={!editingRoom.name.trim() || isLoading}
                          sx={{ 
                            width: 28, 
                            height: 28,
                            color: 'success.main',
                            '&:hover': { backgroundColor: 'success.main', color: 'white' },
                          }}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={handleCancelEdit}
                          disabled={isLoading}
                          sx={{ 
                            width: 28, 
                            height: 28,
                            color: 'text.secondary',
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </ListItem>
                ) : (
                  // Display mode
                  <ListItem 
                    sx={{ 
                      py: 1.5, 
                      px: 2,
                      cursor: disabled ? 'default' : 'pointer',
                      '&:hover': disabled ? {} : {
                        backgroundColor: 'action.hover',
                      },
                    }}
                    onClick={() => !disabled && !editingRoom && !isLoading && handleEditRoom(room)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {room.name}
                        </Typography>
                      </Box>
                      <Fade in={!editingRoom && !isLoading}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room.id);
                          }}
                          disabled={disabled || !!editingRoom || isLoading}
                          sx={{
                            width: 28,
                            height: 28,
                            color: 'error.main',
                            opacity: 0.7,
                            '&:hover': {
                              opacity: 1,
                              backgroundColor: 'error.main',
                              color: 'error.contrastText',
                            },
                            '&:disabled': {
                              color: 'action.disabled',
                            },
                          }}
                        >
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                      </Fade>
                    </Box>
                  </ListItem>
                )}
                {index < rooms.length - 1 && !editingRoom?.id && <Divider />}
              </Box>
            ))}

            {/* New room editing */}
            <Collapse in={editingRoom?.isNew === true}>
              <Box>
                {rooms.length > 0 && <Divider />}
                <ListItem sx={{ py: 1.5, px: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <TextField
                        size="small"
                        placeholder="Room name"
                        value={editingRoom?.name || ''}
                        onChange={(e) => editingRoom && setEditingRoom({ ...editingRoom, name: e.target.value })}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        fullWidth
                        disabled={isLoading}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={handleSaveRoom}
                        disabled={!editingRoom?.name.trim() || isLoading}
                        sx={{ 
                          width: 28, 
                          height: 28,
                          color: 'success.main',
                          '&:hover': { backgroundColor: 'success.main', color: 'white' },
                        }}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={handleCancelEdit}
                        disabled={isLoading}
                        sx={{ 
                          width: 28, 
                          height: 28,
                          color: 'text.secondary',
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </ListItem>
              </Box>
            </Collapse>
          </List>
        )}
      </Box>

      {/* Helper text */}
      {!disabled && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Click + to add, click a room to edit, or click - to remove
        </Typography>
      )}
    </Box>
  );
}