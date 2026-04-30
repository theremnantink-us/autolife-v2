<?php
class TelegramNotifier {
    private $bot_token;
    private $chat_id;
    
    public function __construct($bot_token, $chat_id) {
        $this->bot_token = $bot_token;
        $this->chat_id = $chat_id;
    }
    
    public function sendNewAppointmentNotification($appointment) {
        $message = "🚗 *НОВАЯ ЗАПИСЬ В АВТОЛАЙФ* 🚗\n\n";
        $message .= "[Перейти в админ-панель](https://autolife-detail.ru/admin.php)";
        
        return $this->sendMessage($message);
    }
    
    private function sendMessage($text) {
        $url = "https://api.telegram.org/bot{$this->bot_token}/sendMessage";
        
        $data = [
            'chat_id' => $this->chat_id,
            'text' => $text,
            'parse_mode' => 'Markdown',
            'disable_web_page_preview' => true
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $result = curl_exec($ch);
        curl_close($ch);
        
        return $result;
    }
}


?>