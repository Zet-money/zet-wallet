"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Save, User, Clock, Mail, Settings } from 'lucide-react';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { toast } from 'sonner';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { profile, updateProfile, isLoading } = useUserSettings();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    sessionTimeout: 5
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        username: profile.username || '',
        email: profile.email || '',
        sessionTimeout: profile.sessionTimeout || 5
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateProfile(formData);
      toast.success('Profile updated successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to update profile');
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              User Settings
            </CardTitle>
            <CardDescription>
              Manage your personal information and preferences
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name
            </Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Username
            </Label>
            <Input
              id="username"
              placeholder="Enter your username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email (Optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTimeout" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Session Timeout (minutes)
            </Label>
            <Input
              id="sessionTimeout"
              type="number"
              min="1"
              max="60"
              placeholder="5"
              value={formData.sessionTimeout}
              onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value) || 5)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              How long to keep the app unlocked before requiring biometric authentication again
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
