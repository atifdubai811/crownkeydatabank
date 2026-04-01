const axios = require('axios');
const supabase = require('./supabaseClient');

class WhatsAppService {
  constructor() {
    this.baseURL = process.env.WJ_BASE || 'https://crownkey.online/api';
    this.uid = process.env.WJ_UID;
    this.token = process.env.WJ_TOKEN;
    this.fromPhoneNumberId = process.env.WJ_FROM_PHONE_NUMBER_ID;

    if (!this.uid || !this.token) {
      throw new Error('WJ_UID and WJ_TOKEN must be set in .env');
    }

    this.client = axios.create({
      baseURL: `${this.baseURL}/${this.uid}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      timeout: 30000,
    });
  }

  normalizePhone(raw) {
    let p = String(raw).replace(/\D/g, '');
    if (p.startsWith('00')) p = p.slice(2);
    if (p.startsWith('0')) p = '971' + p.slice(1);
    if (!p.startsWith('971') && p.length === 9) p = '971' + p;
    return p;
  }

  async getTemplate(templateName) {
    try {
      const { data } = await supabase
        .from('templates')
        .select('language, body_text, header_type, header_text, buttons')
        .eq('name', templateName)
        .single();
      return data || {};
    } catch (error) {
      console.error(`[WhatsApp] Failed to fetch template "${templateName}":`, error.message);
      return {};
    }
  }

  async sendTemplate(phone, templateName, languageCode = null, components = []) {
    const to = this.normalizePhone(phone);
    
    // Fetch template details from Supabase
    const tpl = await this.getTemplate(templateName);
    const lang = tpl.language || languageCode || 'en';
    const bodyText = tpl.body_text || '';
    
    console.log(`[WhatsApp] Sending template="${templateName}" lang="${lang}" header_type="${tpl.header_type||'none'}" to=${to}`);

    const payload = {
      phone_number: to,
      template_name: templateName,
      template_language: lang,
    };

    // Add from_phone_number_id if configured
    if (this.fromPhoneNumberId) {
      payload.from_phone_number_id = this.fromPhoneNumberId;
    }

    // Attach header based on type stored in Supabase
    const headerType = (tpl.header_type || '').toUpperCase();
    const headerUrl = tpl.header_text || process.env.WJ_DEFAULT_HEADER_IMAGE || null;
    if (headerType === 'IMAGE' && headerUrl) {
      payload.header_image = headerUrl;
    } else if (headerType === 'VIDEO' && headerUrl) {
      payload.header_video = headerUrl;
    } else if (headerType === 'DOCUMENT' && headerUrl) {
      payload.header_document = headerUrl;
    } else if (headerType === 'TEXT' && tpl.header_text) {
      payload.header_field_1 = tpl.header_text;
    }

    // Extract body variables {{1}}, {{2}}... from body_text and map to field_1, field_2...
    // Use contact data if available via components, otherwise use empty string as placeholder
    const bodyVars = (tpl.body_text || '').match(/\{\{(\d+)\}\}/g) || [];
    const uniqueVars = [...new Set(bodyVars.map(v => parseInt(v.replace(/\D/g, ''))))].sort((a,b)=>a-b);
    const contactData = (components && components[0]) || {};
    const name = contactData.name || ' ';
    const community = contactData.community || ' ';
    uniqueVars.forEach(i => {
      // {{1}} = name, {{2}} = community/name, rest = name fallback
      const fieldMap = { 1: name, 2: community || name, 3: name, 4: name };
      payload[`field_${i}`] = fieldMap[i] || name || ' ';
    });

    // Add extra components if provided
    if (components && components.length > 0) {
      Object.assign(payload, components);
    }

    try {
      const response = await this.client.post('/contact/send-template-message', payload);
      const data = response.data;

      console.log(`[WhatsApp] send-template → ${response.status}:`, JSON.stringify(data).slice(0, 200));

      // Check for failed result even with 200 status
      if (data?.result === 'failed') {
        throw new Error(data.message || 'WhatsApp API returned failed result');
      }

      return {
        wamid: data.id || data.message_id || null,
        to,
        bodyText,
        success: true,
      };
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || 'WhatsApp API error';
      const status = error.response?.status || 500;
      console.error(`[WhatsApp] send-template failed:`, errMsg);
      throw Object.assign(new Error(errMsg), { status });
    }
  }

  async sendText(phone, message) {
    const to = this.normalizePhone(phone);
    console.log(`[WhatsApp] Sending text to=${to}`);

    const payload = {
      phone_number: to,
      message_body: message,
    };

    // Add from_phone_number_id if configured
    if (this.fromPhoneNumberId) {
      payload.from_phone_number_id = this.fromPhoneNumberId;
    }

    try {
      const response = await this.client.post('/contact/send-message', payload);
      const data = response.data;

      console.log(`[WhatsApp] send-message → ${response.status}:`, JSON.stringify(data).slice(0, 200));

      if (data?.result === 'failed') {
        throw new Error(data.message || 'WhatsApp API returned failed result');
      }

      return {
        wamid: data.id || data.message_id || null,
        to,
        success: true,
      };
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || 'WhatsApp API error';
      const status = error.response?.status || 500;
      console.error(`[WhatsApp] send-message failed:`, errMsg);
      throw Object.assign(new Error(errMsg), { status });
    }
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();

module.exports = {
  sendTemplate: (phone, templateName, languageCode, components) =>
    whatsappService.sendTemplate(phone, templateName, languageCode, components),
  sendText: (phone, message) =>
    whatsappService.sendText(phone, message),
  normalizePhone: (phone) =>
    whatsappService.normalizePhone(phone),
};
