import { NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { executeVoiceCoordination } from '@/lib/voice-actions';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as Blob;

        if (!audioFile) {
            return NextResponse.json({ error: 'Không tìm thấy file âm thanh' }, { status: 400 });
        }

        // 1. Transcribe audio to text
        const transcription = await aiService.transcribeAudio(audioFile);
        console.log("Transcription:", transcription);

        // 2. Parse intent from text
        const command = await aiService.parseVoiceCommand(transcription);
        console.log("Parsed Command:", command);

        // 3. Execute coordination
        const result = await executeVoiceCoordination(command);

        return NextResponse.json({ 
            success: result.success,
            message: result.message,
            transcription,
            command
        });

    } catch (error: any) {
        console.error('Voice API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
