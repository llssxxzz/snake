package snake.service.ranklist;

import com.alibaba.fastjson2.JSONObject;

import java.util.Map;

public interface UpdateRanklistService {
    public Map<String ,String > updateRanklist(JSONObject data);
}
