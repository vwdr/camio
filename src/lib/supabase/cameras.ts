import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a Supabase client for database operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to create a new camera record
export async function registerCamera(cameraData: {
  name: string;
  location: string;
  type: string;
  deviceId?: string;
  userId: string;
}) {
  try {
    const { data, error } = await supabase
      .from('cameras')
      .insert({
        name: cameraData.name,
        location: cameraData.location,
        type: cameraData.type,
        device_id: cameraData.deviceId || `camio-${Math.random().toString(36).substring(2, 15)}`,
        user_id: cameraData.userId,
        status: 'offline',
        created_at: new Date().toISOString()
      })
      .select();
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error registering camera:', error);
    return { success: false, error };
  }
}

// Function to get all cameras for a user
export async function getUserCameras(userId: string) {
  try {
    const { data, error } = await supabase
      .from('cameras')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching cameras:', error);
    return { success: false, error, data: [] };
  }
}

// Function to update camera status
export async function updateCameraStatus(cameraId: string, status: 'online' | 'offline') {
  try {
    const { data, error } = await supabase
      .from('cameras')
      .update({ status, last_active: new Date().toISOString() })
      .eq('id', cameraId);
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating camera status:', error);
    return { success: false, error };
  }
}

// Function to register a new WebRTC stream
export async function registerStream(streamData: {
  streamId: string;
  cameraId: string;
  userId: string;
}) {
  try {
    const { data, error } = await supabase
      .from('active_streams')
      .upsert({
        stream_id: streamData.streamId,
        camera_id: streamData.cameraId,
        user_id: streamData.userId,
        started_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      })
      .select();
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error registering stream:', error);
    return { success: false, error };
  }
}