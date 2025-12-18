package snake.controller;

import com.alibaba.fastjson2.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import snake.service.ranklist.UpdateRanklistService;

import java.util.Map;

@RestController
public class UpdateRanklistController {

    @Autowired
    private UpdateRanklistService updateRanklistService;

    @PostMapping("/ranklist/update/")
    public Map<String, String> updateRanklist(@RequestBody Map<String, Object> data) {
        JSONObject json = new JSONObject(data);
        return updateRanklistService.updateRanklist(json);
    }
}